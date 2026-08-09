/**
 * Smoke test chatbot.
 * Prisma dan axios di-stub, sisanya (route, middleware, controller,
 * tool layer, adapter provider) memakai kode asli.
 *
 * Jalankan: node test/chat.smoke.js
 */

process.env.JWT_SECRET = 'test-secret-untuk-smoke-test';
process.env.GEMINI_API_KEY = 'dummy-gemini';
process.env.OPENAI_API_KEY = 'dummy-openai';
process.env.ANTHROPIC_API_KEY = 'dummy-anthropic';
process.env.GROQ_API_KEY = 'dummy-groq';
process.env.LOG_LEVEL = 'error';

const path = require('path');
const Module = require('module');
const assert = require('assert');
const http = require('http');
const jwt = require('jsonwebtoken');

// ============================================================
// STUB PRISMA
// ============================================================

const now = new Date('2026-05-01T08:00:00Z');

const fakeAnswers = [
  // Kuis 101 - Matematika, 2 soal, sudah approved
  {
    answer_id: 1, user_id: 1, submission_date: now,
    question: {
      quiz_id: 101, weight: 1,
      quiz: { quiz_id: 101, title: 'Ulangan Pecahan', subject: { subject_name: 'Matematika' }, grade: { grade_name: 'Kelas 5' } }
    },
    score: { final_score: 8, is_approved: true },
    student: { user_id: 1, name: 'Budi Santoso', userDetail: { grade: { grade_name: 'Kelas 5' } } }
  },
  {
    answer_id: 2, user_id: 1, submission_date: now,
    question: {
      quiz_id: 101, weight: 1,
      quiz: { quiz_id: 101, title: 'Ulangan Pecahan', subject: { subject_name: 'Matematika' }, grade: { grade_name: 'Kelas 5' } }
    },
    score: { final_score: 6, is_approved: true },
    student: { user_id: 1, name: 'Budi Santoso', userDetail: { grade: { grade_name: 'Kelas 5' } } }
  },
  // Kuis 102 - IPA, belum approved
  {
    answer_id: 3, user_id: 1, submission_date: now,
    question: {
      quiz_id: 102, weight: 1,
      quiz: { quiz_id: 102, title: 'Sistem Pencernaan', subject: { subject_name: 'IPA' }, grade: { grade_name: 'Kelas 5' } }
    },
    score: { final_score: 9, is_approved: false },
    student: { user_id: 1, name: 'Budi Santoso', userDetail: { grade: { grade_name: 'Kelas 5' } } }
  }
];

const fakePrisma = {
  $queryRaw: async () => [{ 1: 1 }],
  userDetail: {
    findUnique: async ({ where }) => ({
      user_id: where.user_id,
      is_active: true,
      password_changed_at: null,
      email: 'budi@sekolah.id',
      grade_id: 5,
      user: { name: 'Budi Santoso' },
      grade: { grade_name: 'Kelas 5', school_level: 'SD' }
    })
  },
  user: {
    findUnique: async () => ({ name: 'Budi Santoso' })
  },
  grade: {
    findMany: async () => [{ grade_id: 5 }, { grade_id: 6 }]
  },
  quiz: {
    findMany: async ({ where }) => {
      if (where?.created_by) return [{ quiz_id: 101 }, { quiz_id: 102 }];
      return [
        {
          quiz_id: 101, title: 'Ulangan Pecahan', time_limit: 30, due_date: now, created_at: now,
          teacher: { name: 'Bu Ani' }, subject: { subject_name: 'Matematika' },
          grade: { grade_name: 'Kelas 5', school_level: 'SD' }, _count: { questions: 2 }
        },
        {
          quiz_id: 103, title: 'Kuis Baru Belum Dikerjakan', time_limit: 45, due_date: now, created_at: now,
          teacher: { name: 'Bu Ani' }, subject: { subject_name: 'Bahasa Indonesia' },
          grade: { grade_name: 'Kelas 5', school_level: 'SD' }, _count: { questions: 3 }
        }
      ];
    }
  },
  studentAnswer: {
    findMany: async ({ where, select }) => {
      let rows = fakeAnswers;
      if (where?.score?.is_approved) rows = rows.filter((a) => a.score?.is_approved);
      if (select?.question) return rows.map((a) => ({ question: { quiz_id: a.question.quiz_id } }));
      return rows;
    }
  },
  score: {
    findMany: async () => [
      {
        score_id: 9, is_approved: false,
        answer: {
          student: { user_id: 1, name: 'Budi Santoso' },
          question: { quiz: { title: 'Sistem Pencernaan' } }
        }
      }
    ]
  }
};

// Suntikkan stub ke require cache SEBELUM modul apa pun memuatnya
const prismaPath = require.resolve('../src/config/prismaClient');
require.cache[prismaPath] = new Module(prismaPath, null);
require.cache[prismaPath].filename = prismaPath;
require.cache[prismaPath].loaded = true;
require.cache[prismaPath].exports = fakePrisma;

// ============================================================
// STUB AXIOS
// ============================================================

const axios = require('axios');
const captured = [];
let scriptedResponses = [];

axios.post = async (url, body, config) => {
  captured.push({ url, body, config });
  const next = scriptedResponses.shift();
  if (!next) throw new Error('Tidak ada skenario respons tersisa untuk: ' + url);
  if (next.throw) throw next.throw;
  return { data: next.data };
};

// ============================================================
// APP
// ============================================================

const express = require('express');
const chatRoutes = require('../src/routes/chatRoutes');
const { notFound, errorHandler } = require('../src/middleware/errorHandler');
const { executeTool, getToolSchemas } = require('../src/services/chatToolService');

const app = express();
app.use(express.json());
app.use('/api/chat', chatRoutes);
app.use(notFound);
app.use(errorHandler);

const server = app.listen(0);
const port = server.address().port;

const tokenFor = (userId, roleId) =>
  jwt.sign({ userId, roleId }, process.env.JWT_SECRET, { expiresIn: '1h' });

const STUDENT_TOKEN = tokenFor(1, 3);
const TEACHER_TOKEN = tokenFor(2, 2);

const request = (method, path, token, body) =>
  new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        port, path, method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

// ============================================================
// TES
// ============================================================

let passed = 0;
const check = (label, fn) => {
  try { fn(); console.log(`  ✓ ${label}`); passed++; }
  catch (e) { console.log(`  ✗ ${label}\n    ${e.message}`); process.exitCode = 1; }
};

const run = async () => {
  console.log('\n[1] Auth & akses');
  {
    const res = await request('POST', '/api/chat', null, { message: 'halo' });
    check('tanpa token ditolak 401', () => assert.strictEqual(res.status, 401));
  }
  {
    const res = await request('POST', '/api/chat', STUDENT_TOKEN, { message: '' });
    check('pesan kosong ditolak 400', () => assert.strictEqual(res.status, 400));
  }

  console.log('\n[2] Tool layer: pemisahan role');
  {
    const studentTools = getToolSchemas(3).map((t) => t.name);
    const teacherTools = getToolSchemas(2).map((t) => t.name);
    check('siswa tidak melihat tool guru', () =>
      assert.ok(!studentTools.includes('list_my_students')));
    check('guru punya tool list_my_students', () =>
      assert.ok(teacherTools.includes('list_my_students')));
    check('siswa punya 4 tool', () => assert.strictEqual(studentTools.length, 4));
    check('guru punya 5 tool', () => assert.strictEqual(teacherTools.length, 5));
  }
  {
    // Siswa mencoba memanggil tool guru secara paksa
    const out = await executeTool({
      name: 'list_my_students', args: {}, userId: 1, roleId: 3
    });
    check('siswa dipaksa panggil tool guru → ditolak', () =>
      assert.ok(out.error && out.error.includes('tidak tersedia')));
  }

  console.log('\n[3] Tool layer: hasil query');
  {
    const out = await executeTool({ name: 'get_my_scores', args: {}, userId: 1, roleId: 3 });
    check('nilai approved dihitung berbobot & dinormalisasi ke 0-100', () => {
      const mtk = out.nilai.find((n) => n.mata_pelajaran === 'Matematika');
      assert.strictEqual(mtk.nilai, 70); // (8*10 + 6*10) / 2
    });
    check('nilai belum approved disembunyikan (null)', () => {
      const ipa = out.nilai.find((n) => n.mata_pelajaran === 'IPA');
      assert.strictEqual(ipa.nilai, null);
      assert.ok(ipa.status.includes('menunggu'));
    });
  }
  {
    const out = await executeTool({ name: 'get_my_score_summary', args: {}, userId: 1, roleId: 3 });
    check('ringkasan hanya menghitung yang approved', () =>
      assert.strictEqual(out.kuis_selesai, 1));
    check('rata-rata benar', () => assert.strictEqual(out.rata_rata, 70));
  }
  {
    const out = await executeTool({ name: 'get_my_pending_quizzes', args: {}, userId: 1, roleId: 3 });
    check('kuis yang sudah dikerjakan tidak muncul di pending', () => {
      assert.strictEqual(out.jumlah, 1);
      assert.strictEqual(out.tugas[0].kuis, 'Kuis Baru Belum Dikerjakan');
    });
  }
  {
    const out = await executeTool({ name: 'list_my_students', args: {}, userId: 2, roleId: 2 });
    check('guru melihat siswa yang mengerjakan kuisnya', () => {
      assert.strictEqual(out.jumlah, 1);
      assert.strictEqual(out.siswa[0].nama, 'Budi Santoso');
      assert.strictEqual(out.siswa[0].kuis_dikerjakan, 2);
    });
  }
  {
    const out = await executeTool({
      name: 'get_quiz_statistics', args: { quiz_id: 999 }, userId: 2, roleId: 2
    });
    check('guru tidak bisa lihat statistik kuis milik orang lain', () =>
      assert.ok(out.error && out.error.includes('bukan milik Anda')));
  }

  console.log('\n[4] Loop tool calling end-to-end (Gemini)');
  {
    captured.length = 0;
    scriptedResponses = [
      { data: { candidates: [{ content: { parts: [{ functionCall: { name: 'get_my_score_summary', args: {} } }] } }] } },
      { data: { candidates: [{ content: { parts: [{ text: 'Rata-rata nilaimu 70. Bagus, terus semangat!' }] } }] } }
    ];
    const res = await request('POST', '/api/chat', STUDENT_TOKEN, {
      message: 'gimana nilaiku?', provider: 'gemini'
    });
    check('status 200', () => assert.strictEqual(res.status, 200));
    check('jawaban akhir diteruskan ke client', () =>
      assert.ok(res.body.data.reply.includes('70')));
    check('tool tercatat di tools_used', () =>
      assert.deepStrictEqual(res.body.data.tools_used, ['get_my_score_summary']));
    check('ronde kedua mengirim functionResponse berisi data asli', () => {
      const parts = captured[1].body.contents.flatMap((c) => c.parts);
      const fr = parts.find((p) => p.functionResponse);
      assert.strictEqual(fr.functionResponse.response.result.rata_rata, 70);
    });
    check('systemInstruction memuat nama siswa', () =>
      assert.ok(captured[0].body.systemInstruction.parts[0].text.includes('Budi Santoso')));
    check('hanya tool siswa yang dikirim ke Gemini', () => {
      const names = captured[0].body.tools[0].functionDeclarations.map((f) => f.name);
      assert.ok(!names.includes('list_my_students'));
    });
  }

  console.log('\n[5] Adapter OpenAI');
  {
    captured.length = 0;
    scriptedResponses = [
      { data: { choices: [{ message: { tool_calls: [{ id: 'call_1', function: { name: 'get_my_scores', arguments: '{"subject_name":"Matematika"}' } }] } }] } },
      { data: { choices: [{ message: { content: 'Nilai Matematika kamu 70.' } }] } }
    ];
    const res = await request('POST', '/api/chat', STUDENT_TOKEN, {
      message: 'nilai matematika?', provider: 'openai'
    });
    check('status 200', () => assert.strictEqual(res.status, 200));
    check('argumen tool ter-parse & filter mapel jalan', () => {
      const toolMsg = captured[1].body.messages.find((m) => m.role === 'tool');
      const parsed = JSON.parse(toolMsg.content);
      assert.strictEqual(parsed.nilai.length, 1);
      assert.strictEqual(parsed.nilai[0].mata_pelajaran, 'Matematika');
    });
    check('header Authorization terpasang', () =>
      assert.ok(captured[0].config.headers.Authorization.startsWith('Bearer ')));
  }

  console.log('\n[6] Adapter Claude');
  {
    captured.length = 0;
    scriptedResponses = [
      { data: { content: [{ type: 'tool_use', id: 'toolu_1', name: 'get_my_pending_quizzes', input: {} }] } },
      { data: { content: [{ type: 'text', text: 'Ada 1 tugas yang belum kamu kerjakan.' }] } }
    ];
    const res = await request('POST', '/api/chat', STUDENT_TOKEN, {
      message: 'tugas apa yang belum?', provider: 'claude'
    });
    check('status 200', () => assert.strictEqual(res.status, 200));
    check('tool_result dikirim sebagai content block user', () => {
      const last = captured[1].body.messages[captured[1].body.messages.length - 1];
      assert.strictEqual(last.role, 'user');
      assert.strictEqual(last.content[0].type, 'tool_result');
      assert.strictEqual(last.content[0].tool_use_id, 'toolu_1');
    });
    check('header anthropic-version terpasang', () =>
      assert.strictEqual(captured[0].config.headers['anthropic-version'], '2023-06-01'));
  }


  console.log('\n[6b] Adapter Groq (OpenAI-compatible)');
  {
    captured.length = 0;
    scriptedResponses = [
      { data: { choices: [{ message: { tool_calls: [{ id: 'call_g1', function: { name: 'list_my_students', arguments: '{}' } }] } }] } },
      { data: { choices: [{ message: { content: 'Ada 1 siswa: Budi Santoso.' } }] } }
    ];
    const res = await request('POST', '/api/chat', TEACHER_TOKEN, {
      message: 'siapa saja siswa saya?', provider: 'groq'
    });
    check('status 200', () => assert.strictEqual(res.status, 200));
    check('diarahkan ke endpoint Groq, bukan OpenAI', () =>
      assert.strictEqual(captured[0].url, 'https://api.groq.com/openai/v1/chat/completions'));
    check('pakai GROQ_API_KEY, bukan OPENAI_API_KEY', () =>
      assert.strictEqual(captured[0].config.headers.Authorization, 'Bearer dummy-groq'));
    check('model default Groq terkirim', () =>
      assert.strictEqual(captured[0].body.model, 'openai/gpt-oss-120b'));
    check('pakai max_completion_tokens, bukan max_tokens', () => {
      assert.ok(captured[0].body.max_completion_tokens);
      assert.strictEqual(captured[0].body.max_tokens, undefined);
    });
    check('tool guru dieksekusi & hasilnya dikirim balik', () => {
      const toolMsg = captured[1].body.messages.find((m) => m.role === 'tool');
      assert.strictEqual(JSON.parse(toolMsg.content).siswa[0].nama, 'Budi Santoso');
    });
  }

  console.log('\n[7] Penanganan error & batas');
  {
    scriptedResponses = [{ throw: Object.assign(new Error('bad key'), { response: { status: 401 } }) }];
    const res = await request('POST', '/api/chat', STUDENT_TOKEN, { message: 'halo', provider: 'openai' });
    check('API key ditolak → 503 dengan pesan jelas', () => {
      assert.strictEqual(res.status, 503);
      assert.ok(res.body.message.includes('OPENAI_API_KEY'));
    });
  }
  {
    const res = await request('POST', '/api/chat', STUDENT_TOKEN, { message: 'halo', provider: 'llama' });
    check('provider tak dikenal → 503 dengan pesan jelas', () => { assert.strictEqual(res.status, 503); assert.ok(res.body.message.includes('tidak dikenal')); });
  }
  {
    // LLM minta tool terus-menerus → harus berhenti di MAX_TOOL_ROUNDS
    scriptedResponses = Array.from({ length: 6 }, () => ({
      data: { candidates: [{ content: { parts: [{ functionCall: { name: 'get_my_profile', args: {} } }] } }] }
    }));
    const res = await request('POST', '/api/chat', STUDENT_TOKEN, { message: 'loop', provider: 'gemini' });
    check('loop tool dihentikan di ronde ke-4', () => {
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.tools_used.length, 4);
    });
  }
  {
    const res = await request('GET', '/api/chat/providers', STUDENT_TOKEN);
    check('daftar provider mengembalikan 4 yang aktif', () =>
      assert.strictEqual(res.body.data.providers.length, 4));
  }

  {
    scriptedResponses = [{ throw: Object.assign(new Error('not found'), { response: { status: 404 } }) }];
    const res = await request('POST', '/api/chat', TEACHER_TOKEN, { message: 'halo', provider: 'gemini' });
    check('model dipensiunkan → pesan arahkan ganti model', () => {
      assert.strictEqual(res.status, 503);
      assert.ok(res.body.message.includes('tidak tersedia'));
    });
  }
  {
    captured.length = 0;
    scriptedResponses = [{ data: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] } }];
    await request('POST', '/api/chat', TEACHER_TOKEN, { message: 'halo', provider: 'gemini' });
    check('API key Gemini dikirim via header, tidak di URL', () => {
      assert.ok(!captured[0].url.includes('key='));
      assert.strictEqual(captured[0].config.headers['x-goog-api-key'], 'dummy-gemini');
    });
  }
  console.log('\n[9] Pembatasan topik');
  {
    const names = getToolSchemas(3).map((t) => t.name);
    check('tool penolakan tersedia untuk siswa', () =>
      assert.ok(names.includes('tolak_di_luar_topik')));
    check('siswa kini punya 6 tool (4 data + 2 meta)', () =>
      assert.strictEqual(names.length, 6));
  }
  {
    captured.length = 0;
    scriptedResponses = [
      { data: { choices: [{ message: { tool_calls: [{ id: 'c1', function: { name: 'tolak_di_luar_topik', arguments: '{"topik":"minta puisi"}' } }] } }] } }
    ];
    const res = await request('POST', '/api/chat', STUDENT_TOKEN, {
      message: 'buatkan aku puisi tentang hujan', provider: 'groq'
    });
    check('permintaan di luar topik ditolak', () => {
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.reply.includes('cuma bisa bantu soal kuis'));
    });
    check('hemat: tidak ada panggilan LLM kedua', () =>
      assert.strictEqual(captured.length, 1));
    check('putaran pertama memaksa model memilih tool', () =>
      assert.strictEqual(captured[0].body.tool_choice, 'required'));
  }
  {
    captured.length = 0;
    scriptedResponses = [
      { data: { candidates: [{ content: { parts: [{ functionCall: { name: 'tolak_di_luar_topik', args: {} } }] } }] } }
    ];
    await request('POST', '/api/chat', STUDENT_TOKEN, { message: 'ibukota perancis?', provider: 'gemini' });
    check('Gemini juga dipaksa lewat functionCallingConfig ANY', () =>
      assert.strictEqual(captured[0].body.toolConfig.functionCallingConfig.mode, 'ANY'));
  }
  {
    captured.length = 0;
    scriptedResponses = [
      { data: { content: [{ type: 'tool_use', id: 't1', name: 'jawab_sapaan', input: {} }] } }
    ];
    const res = await request('POST', '/api/chat', TEACHER_TOKEN, { message: 'halo', provider: 'claude' });
    check('Claude dipaksa lewat tool_choice any', () =>
      assert.strictEqual(captured[0].body.tool_choice.type, 'any'));
    check('sapaan guru dapat balasan sesuai role', () =>
      assert.ok(res.body.data.reply.includes('siswa Anda')));
  }
  {
    captured.length = 0;
    scriptedResponses = [
      { data: { choices: [{ message: { tool_calls: [{ id: 'c2', function: { name: 'get_my_score_summary', arguments: '{}' } }] } }] } },
      { data: { choices: [{ message: { content: 'Rata-rata nilaimu 70.' } }] } }
    ];
    const res = await request('POST', '/api/chat', STUDENT_TOKEN, {
      message: 'gimana nilaiku?', provider: 'groq'
    });
    check('pertanyaan sah tetap dijawab normal', () =>
      assert.ok(res.body.data.reply.includes('70')));
    check('putaran kedua TIDAK dipaksa (boleh jawab teks)', () =>
      assert.strictEqual(captured[1].body.tool_choice, undefined));
  }

  console.log('\n[8] Rate limit per user');
  {
    scriptedResponses = Array.from({ length: 40 }, () => ({
      data: { candidates: [{ content: { parts: [{ text: 'ok' }] } }] }
    }));
    let limited = false;
    for (let i = 0; i < 20; i++) {
      const res = await request('POST', '/api/chat', STUDENT_TOKEN, { message: 'spam', provider: 'gemini' });
      if (res.status === 429) { limited = true; break; }
    }
    check('user yang spam kena 429', () => assert.ok(limited));

    const res = await request('POST', '/api/chat', TEACHER_TOKEN, { message: 'halo', provider: 'gemini' });
    check('user lain tidak ikut kena limit', () => assert.notStrictEqual(res.status, 429));
  }


  console.log(`\n${passed} tes lulus.\n`);
  server.close();
};

run().catch((e) => { console.error(e); server.close(); process.exit(1); });