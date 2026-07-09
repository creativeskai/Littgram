// /api/diagnose.js
// Diagnostic tool. Open in a browser to inspect a stuck OCR job directly:
//   /api/diagnose?job_id=20260613_dab1265f-dec0-46a2-b1e4-455ee5e323e5
// Returns the RAW Sarvam status response (every field, untouched) so we can
// see exactly what state the job is in and why it isn't completing.
//
// With no job_id, it instead creates a tiny test job to confirm the key works:
//   /api/diagnose            → checks SARVAM_KEY + job creation

const SARVAM_KEY = process.env.SARVAM_KEY;
const SARVAM_DOC = 'https://api.sarvam.ai/doc-digitization/job/v1';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  const { requireAuth } = await import('./_lib.js');
  if (!(await requireAuth(req, res, { limit: 30 }))) return;

  const out = { key_present: !!SARVAM_KEY, key_prefix: SARVAM_KEY ? SARVAM_KEY.slice(0, 8) + '…' : null };
  if (!SARVAM_KEY) { out.error = 'SARVAM_KEY not set on Vercel'; return res.status(200).json(out); }

  const { job_id } = req.query;

  try {
    if (job_id) {
      // Inspect an existing job — return the RAW Sarvam response untouched
      const r = await fetch(`${SARVAM_DOC}/${job_id}/status`, {
        headers: { 'api-subscription-key': SARVAM_KEY },
      });
      out.http_status = r.status;
      const text = await r.text();
      try { out.raw_sarvam_response = JSON.parse(text); }
      catch { out.raw_sarvam_response_text = text.slice(0, 1000); }

      // Pull out the fields our code relies on, so mismatches are obvious
      if (out.raw_sarvam_response) {
        const s = out.raw_sarvam_response;
        out.parsed = {
          job_state_field: s.job_state ?? '(missing!)',
          status_field: s.status ?? '(none)',
          state_field: s.state ?? '(none)',
          error_message: s.error_message ?? null,
          job_details: s.job_details ?? null,
          all_top_level_keys: Object.keys(s),
        };
      }
      return res.status(200).json(out);
    }

    // No job_id — test that we can create a job at all
    const cr = await fetch(SARVAM_DOC, {
      method: 'POST',
      headers: { 'api-subscription-key': SARVAM_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_parameters: { language: 'bn-IN', output_format: 'md' } }),
    });
    out.create_job_http_status = cr.status;
    const ctext = await cr.text();
    try { out.create_job_response = JSON.parse(ctext); }
    catch { out.create_job_response_text = ctext.slice(0, 1000); }
    out.diagnosis = cr.ok
      ? 'Key works and job creation succeeds. Add ?job_id=YOUR_STUCK_JOB to inspect a stalled job.'
      : 'Job creation FAILED — this is why OCR never completes. See create_job_response for the reason.';
    return res.status(200).json(out);
  } catch (err) {
    out.exception = err.message;
    return res.status(200).json(out);
  }
}
