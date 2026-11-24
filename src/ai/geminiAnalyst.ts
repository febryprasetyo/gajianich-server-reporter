import { GoogleGenAI } from '@google/genai';
import { AggregatedWeeklyMetrics } from '../aggregator/dataAggregator.js';
import { loadConfig } from '../config/env.js';
import { AiAuditAnalysisResult, generateRuleBasedAnalysis } from './ruleBasedFallback.js';

export async function analyzeWeeklyMetrics(data: AggregatedWeeklyMetrics): Promise<AiAuditAnalysisResult> {
  const config = loadConfig();

  // If no Gemini API key provided, seamlessly use the robust rule-based engine
  if (!config.geminiApiKey) {
    console.log('[Gemini Analyst] GEMINI_API_KEY tidak ditemukan. Menggunakan Rule-Based Fallback Engine.');
    return generateRuleBasedAnalysis(data);
  }

  try {
    console.log('[Gemini Analyst] Menghubungi Google Gemini 2.5 Flash API...');
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

    const prompt = `Anda adalah Senior IT Infrastructure & Security Auditor untuk GAJIANICH.
Evaluasi dataset telemetri mingguan server berikut ini:
${JSON.stringify(data, null, 2)}

Berikan analisis audit resmi dalam format JSON murni (tanpa markdown fences, tanpa pengantar, tanpa penutup) dengan struktur berikut:
{
  "overallStatus": "NORMAL" | "WARNING" | "CRITICAL",
  "executiveSummary": "Paragraf padat (3-4 kalimat) dalam Bahasa Indonesia formal yang merangkum kesehatan sistem, utilisasi sumber daya, dan SLA mingguan.",
  "incidentRca": "Analisis akar masalah jika ada lonjakan RAM, CPU, restart kontainer, atau serangan SSH. Tulis null jika tidak ada insiden.",
  "recommendations": [
    {
      "priority": "TINGGI" | "SEDANG" | "RENDAH",
      "title": "Judul rekomendasi singkat",
      "action": "Tindakan teknis yang spesifik dan solutif"
    }
  ]
}
Pastikan rekomendasi berjumlah tepat 3 poin dengan urutan prioritas yang relevan.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text?.trim() || '';
    if (!responseText) {
      throw new Error('Respon Gemini API kosong.');
    }

    const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleanJson) as AiAuditAnalysisResult;

    if (!parsed.overallStatus || !parsed.executiveSummary || !Array.isArray(parsed.recommendations)) {
      throw new Error('Format JSON dari Gemini tidak sesuai spesifikasi.');
    }

    console.log(`[Gemini Analyst] Analisis berhasil diselesaikan: Status ${parsed.overallStatus}`);
    return parsed;
  } catch (err: any) {
    console.warn(`[Gemini Analyst] Peringatan: API Gemini gagal (${err?.message || err}). Beralih otomatis ke Rule-Based Fallback Engine.`);
    return generateRuleBasedAnalysis(data);
  }
}
