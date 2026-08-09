const axios = require('axios');
const logger = require('../utils/loggerUtils');

/**
 * ============================================================
 * ADAPTER MULTI-PROVIDER
 * ------------------------------------------------------------
 * Ketiga provider mendukung tool calling, tapi bentuk request dan
 * response-nya beda. File ini menyeragamkannya jadi satu bentuk
 * kanonik supaya chatController tidak perlu tahu provider apa
 * yang sedang dipakai.
 *
 * Bentuk pesan kanonik:
 *   { role: 'user',      content: string }
 *   { role: 'assistant', content: string|null, tool_calls?: [{id, name, args}] }
 *   { role: 'tool',      tool_call_id: string, name: string, content: string }
 *
 * Bentuk balasan kanonik:
 *   { type: 'text',       text: string }
 *   { type: 'tool_calls', calls: [{id, name, args}] }
 * ============================================================
 */

const TIMEOUT_MS = parseInt(process.env.CHAT_TIMEOUT_MS || '60000', 10);
const MAX_TOKENS = parseInt(process.env.CHAT_MAX_TOKENS || '1024', 10);

const PROVIDERS = {
  gemini: {
    label: 'Gemini',
    envKey: 'GEMINI_API_KEY',
    // Nama model BERUBAH cukup sering dan yang lama dipensiunkan.
    // Kalau muncul error "model tidak ditemukan", cek daftar terbaru di
    // https://ai.google.dev/gemini-api/docs/models lalu set GEMINI_MODEL di .env.
    defaultModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  },
  openai: {
    label: 'GPT',
    envKey: 'OPENAI_API_KEY',
    // Cek https://platform.openai.com/docs/models lalu set OPENAI_MODEL di .env.
    defaultModel: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
    baseUrl: 'https://api.openai.com/v1'
  },
  groq: {
    label: 'Groq',
    envKey: 'GROQ_API_KEY',
    // Groq OpenAI-compatible, jadi pakai adapter yang sama dengan OpenAI.
    // gpt-oss-120b dipilih karena tool calling-nya andal dan harganya murah.
    // Alternatif: llama-3.3-70b-versatile (lebih pintar, lebih mahal) atau
    // llama-3.1-8b-instant (paling murah, tapi sering salah pilih tool).
    // Daftar terbaru: https://console.groq.com/docs/models
    defaultModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    baseUrl: 'https://api.groq.com/openai/v1'
  },
  claude: {
    label: 'Claude',
    envKey: 'ANTHROPIC_API_KEY',
    // Cek https://docs.claude.com/en/docs/about-claude/models lalu set ANTHROPIC_MODEL.
    defaultModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
  }
};

const DEFAULT_PROVIDER = process.env.CHAT_DEFAULT_PROVIDER || 'gemini';

/** Provider mana saja yang API key-nya sudah diisi di .env */
const getAvailableProviders = () =>
  Object.entries(PROVIDERS)
    .filter(([, cfg]) => Boolean(process.env[cfg.envKey]))
    .map(([id, cfg]) => ({ id, label: cfg.label, model: cfg.defaultModel }));

// ============================================================
// ANTHROPIC (Claude)
// ============================================================

const callClaude = async ({ model, systemPrompt, messages, tools, forceTool }) => {
  const body = {
    model,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: toClaudeMessages(messages)
  };

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));
    // "any" = wajib pilih salah satu tool, tidak boleh menjawab bebas
    if (forceTool) body.tool_choice = { type: 'any' };
  }

  const res = await axios.post('https://api.anthropic.com/v1/messages', body, {
    timeout: TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    }
  });

  const blocks = res.data?.content || [];
  const toolUses = blocks.filter((b) => b.type === 'tool_use');

  if (toolUses.length > 0) {
    return {
      type: 'tool_calls',
      calls: toolUses.map((b) => ({ id: b.id, name: b.name, args: b.input || {} }))
    };
  }

  return {
    type: 'text',
    text: blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim()
  };
};

/** Claude menaruh tool_result sebagai content block di pesan user. */
const toClaudeMessages = (messages) => {
  const out = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      out.push({ role: 'user', content: msg.content });
      continue;
    }

    if (msg.role === 'assistant') {
      const content = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      for (const call of msg.tool_calls || []) {
        content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.args });
      }
      if (content.length > 0) out.push({ role: 'assistant', content });
      continue;
    }

    if (msg.role === 'tool') {
      const last = out[out.length - 1];
      const block = {
        type: 'tool_result',
        tool_use_id: msg.tool_call_id,
        content: msg.content
      };
      // Beberapa tool_result berurutan harus digabung dalam satu pesan user
      if (last && last.role === 'user' && Array.isArray(last.content)) {
        last.content.push(block);
      } else {
        out.push({ role: 'user', content: [block] });
      }
    }
  }

  return out;
};

// ============================================================
// OPENAI-COMPATIBLE (GPT & Groq)
// ------------------------------------------------------------
// Groq mengekspos endpoint dengan format identik OpenAI, jadi satu
// adapter dipakai berdua — cukup beda baseUrl dan API key.
// ============================================================

const callOpenAICompatible = async ({
  model, systemPrompt, messages, tools, baseUrl, apiKey, forceTool
}) => {
  const body = {
    model,
    // WAJIB max_completion_tokens, bukan max_tokens. Model GPT-5.x menolak
    // max_tokens, dan Groq juga sudah memindahkan ke parameter ini.
    max_completion_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg) => {
        if (msg.role === 'tool') {
          return { role: 'tool', tool_call_id: msg.tool_call_id, content: msg.content };
        }
        if (msg.role === 'assistant' && msg.tool_calls?.length) {
          return {
            role: 'assistant',
            content: msg.content || null,
            tool_calls: msg.tool_calls.map((c) => ({
              id: c.id,
              type: 'function',
              function: { name: c.name, arguments: JSON.stringify(c.args) }
            }))
          };
        }
        return { role: msg.role, content: msg.content };
      })
    ]
  };

  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters }
    }));
    if (forceTool) body.tool_choice = 'required';
  }

  const res = await axios.post(`${baseUrl}/chat/completions`, body, {
    timeout: TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    }
  });

  const message = res.data?.choices?.[0]?.message;

  if (message?.tool_calls?.length) {
    return {
      type: 'tool_calls',
      calls: message.tool_calls.map((c) => ({
        id: c.id,
        name: c.function.name,
        args: safeParseJson(c.function.arguments)
      }))
    };
  }

  return { type: 'text', text: (message?.content || '').trim() };
};

// ============================================================
// GEMINI
// ============================================================

const callGemini = async ({ model, systemPrompt, messages, tools, forceTool }) => {
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: toGeminiContents(messages)
  };

  if (tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          // Gemini menolak object properties kosong, jadi kirim schema
          // hanya kalau tool memang punya parameter
          ...(Object.keys(t.parameters?.properties || {}).length > 0
            ? { parameters: t.parameters }
            : {})
        }))
      }
    ];
    if (forceTool) {
      body.toolConfig = { functionCallingConfig: { mode: 'ANY' } };
    }
  }

  // API key dikirim lewat header, bukan query string. Kalau lewat ?key=...,
  // kunci ikut tercatat di access log server, proxy, dan riwayat error.
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await axios.post(url, body, {
    timeout: TIMEOUT_MS,
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY
    }
  });

  const parts = res.data?.candidates?.[0]?.content?.parts || [];
  const functionCalls = parts.filter((p) => p.functionCall);

  if (functionCalls.length > 0) {
    return {
      type: 'tool_calls',
      calls: functionCalls.map((p) => ({
        // Gemini tidak memberi id, jadi kita pakai nama sebagai korelator
        id: p.functionCall.name,
        name: p.functionCall.name,
        args: p.functionCall.args || {}
      }))
    };
  }

  return {
    type: 'text',
    text: parts
      .map((p) => p.text || '')
      .join('\n')
      .trim()
  };
};

const toGeminiContents = (messages) => {
  const out = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      out.push({ role: 'user', parts: [{ text: msg.content }] });
      continue;
    }

    if (msg.role === 'assistant') {
      const parts = [];
      if (msg.content) parts.push({ text: msg.content });
      for (const call of msg.tool_calls || []) {
        parts.push({ functionCall: { name: call.name, args: call.args } });
      }
      if (parts.length > 0) out.push({ role: 'model', parts });
      continue;
    }

    if (msg.role === 'tool') {
      out.push({
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: msg.name,
              response: { result: safeParseJson(msg.content) }
            }
          }
        ]
      });
    }
  }

  return out;
};

// ============================================================
// ENTRY POINT
// ============================================================

const safeParseJson = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
};

/**
 * @param {{provider?: string, systemPrompt: string, messages: Array, tools: Array}} params
 * @returns {Promise<{type: 'text'|'tool_calls', text?: string, calls?: Array}>}
 */
const chatWithTools = async ({ provider, systemPrompt, messages, tools = [], forceTool = false }) => {
  const providerId = (provider || DEFAULT_PROVIDER).toLowerCase();
  const config = PROVIDERS[providerId];

  if (!config) {
    throw new Error(
      `Provider "${providerId}" tidak dikenal. Pilihan: ${Object.keys(PROVIDERS).join(', ')}.`
    );
  }

  const apiKey = process.env[config.envKey];
  if (!apiKey) {
    throw new Error(
      `${config.label} belum dikonfigurasi. Isi ${config.envKey} di file .env backend.`
    );
  }

  const payload = { model: config.defaultModel, systemPrompt, messages, tools, forceTool };

  try {
    if (providerId === 'claude') return await callClaude(payload);
    if (providerId === 'openai' || providerId === 'groq') {
      return await callOpenAICompatible({ ...payload, baseUrl: config.baseUrl, apiKey });
    }
    return await callGemini(payload);
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      logger.error(`Chat provider ${providerId} timeout setelah ${TIMEOUT_MS}ms`);
      throw new Error(`${config.label} tidak merespons. Coba lagi sebentar lagi.`);
    }

    const status = error.response?.status;
    const detail = error.response?.data?.error?.message || error.message;
    logger.error(`Chat provider ${providerId} gagal (${status || 'no status'}): ${detail}`);

    if (status === 401 || status === 403) {
      throw new Error(`API key ${config.label} ditolak. Periksa ${config.envKey} di .env.`);
    }
    if (status === 404 || /model/i.test(detail || '')) {
      // Penyebab paling sering: nama model sudah dipensiunkan provider
      throw new Error(
        `Model "${config.defaultModel}" tidak tersedia di ${config.label}. ` +
          `Nama model berubah dari waktu ke waktu — cek daftar terbaru di dokumentasi ` +
          `provider, lalu set ulang variabel model di .env.`
      );
    }
    if (status === 429) {
      throw new Error(`Kuota ${config.label} sedang penuh. Coba lagi beberapa saat lagi.`);
    }
    throw new Error(`Gagal menghubungi ${config.label}.`);
  }
};

module.exports = {
  chatWithTools,
  getAvailableProviders,
  DEFAULT_PROVIDER,
  PROVIDERS
};