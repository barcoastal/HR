"use client";

import { useState } from "react";

type Position = {
  id: string;
  title: string;
  department: string | null;
  description: string | null;
  requirements: string | null;
  salary: string | null;
  location: string | null;
  type: string | null;
  createdAt: string;
};

export function CareersPage({ positions }: { positions: Position[] }) {
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [applyPositionId, setApplyPositionId] = useState<string | null>(null);

  function handleApply(positionId: string) {
    setApplyPositionId(positionId);
    setShowApplyForm(true);
    setSelectedPosition(null);
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>
      {/* Nav */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <a href="https://www.coastaldebt.com" className="flex items-center gap-2">
            <img src="/careers-logo-dark.svg" alt="Coastal Debt Resolve" className="h-8" />
          </a>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="https://www.coastaldebt.com/#services" className="hover:text-[#3052FF] transition-colors">What we offer</a>
            <a href="https://www.coastaldebt.com/#about" className="hover:text-[#3052FF] transition-colors">About us</a>
            <a href="https://www.coastaldebt.com/#testimonials" className="hover:text-[#3052FF] transition-colors">Testimonials</a>
            <span className="font-semibold text-[#3052FF]">Careers</span>
          </div>
          <a
            href="tel:8887077177"
            className="hidden sm:flex items-center gap-2 text-sm font-semibold text-[#3052FF]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            (888) 707-7177
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#3052FF] to-[#1a2e6e] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Join Our Team
          </h1>
          <p className="text-lg sm:text-xl text-blue-100 max-w-2xl mx-auto mb-8">
            Help small businesses break free from debt. We&apos;re looking for passionate people to make a difference.
          </p>
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold">110+</div>
              <div className="text-blue-200">Employees</div>
            </div>
            <div className="w-px h-10 bg-blue-400/30" />
            <div className="text-center">
              <div className="text-2xl font-bold">46</div>
              <div className="text-blue-200">States</div>
            </div>
            <div className="w-px h-10 bg-blue-400/30" />
            <div className="text-center">
              <div className="text-2xl font-bold">4.4/5</div>
              <div className="text-blue-200">Google Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Open Positions</h2>
        <p className="text-gray-500 mb-8">{positions.length} open role{positions.length !== 1 ? "s" : ""}</p>

        {positions.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.193 23.193 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No open positions right now</h3>
            <p className="text-gray-500 text-sm">Check back soon — we&apos;re always growing!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {positions.map((pos) => (
              <div
                key={pos.id}
                onClick={() => setSelectedPosition(pos)}
                className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 hover:border-[#3052FF]/40 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#3052FF] transition-colors">
                      {pos.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-gray-500">
                      {pos.department && (
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          {pos.department}
                        </span>
                      )}
                      {pos.location && (
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          {pos.location}
                        </span>
                      )}
                      {pos.type && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-[#3052FF] text-xs font-medium">
                          {pos.type}
                        </span>
                      )}
                      {pos.salary && (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          {pos.salary}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleApply(pos.id); }}
                    className="self-start sm:self-center px-5 py-2 rounded-lg text-sm font-semibold bg-[#3052FF] text-white hover:bg-[#2442dd] transition-colors shrink-0"
                  >
                    Apply Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Why Join Us */}
      <section className="bg-gray-50 py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-10">Why Coastal Debt?</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { title: "Growth & Development", desc: "Continuous learning, mentorship programs, and clear paths for career advancement.", icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" },
              { title: "People First Culture", desc: "We value our team. Medical, dental, and vision insurance plus generous PTO.", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
              { title: "Make an Impact", desc: "Help real business owners overcome financial challenges and build stronger futures.", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-6 border border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-[#3052FF]/10 flex items-center justify-center mb-4">
                  <svg className="w-5 h-5 text-[#3052FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0f1c2e] text-white py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
            <div>
              <img src="/careers-logo-white.svg" alt="Coastal Debt Resolve" className="h-7 mb-3" />
              <p className="text-sm text-gray-400">6700 North Andrews Ave, Suite 500</p>
              <p className="text-sm text-gray-400">Fort Lauderdale, FL 33309</p>
            </div>
            <div className="text-center sm:text-right">
              <a href="tel:8887077177" className="text-sm font-semibold text-white hover:text-[#3052FF] transition-colors">(888) 707-7177</a>
              <p className="text-sm text-gray-400 mt-1">&copy; {new Date().getFullYear()} Coastal Debt Resolve. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Position Detail Modal */}
      {selectedPosition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelectedPosition(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 sm:p-8">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{selectedPosition.title}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-500">
                    {selectedPosition.department && <span>{selectedPosition.department}</span>}
                    {selectedPosition.location && <span>· {selectedPosition.location}</span>}
                    {selectedPosition.type && <span>· {selectedPosition.type}</span>}
                    {selectedPosition.salary && <span>· {selectedPosition.salary}</span>}
                  </div>
                </div>
                <button onClick={() => setSelectedPosition(null)} className="text-gray-400 hover:text-gray-600 p-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {selectedPosition.description && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">About the Role</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedPosition.description}</p>
                </div>
              )}

              {selectedPosition.requirements && (
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-2">Requirements</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedPosition.requirements}</p>
                </div>
              )}

              <button
                onClick={() => handleApply(selectedPosition.id)}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-[#3052FF] text-white hover:bg-[#2442dd] transition-colors"
              >
                Apply for this Position
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Modal */}
      {showApplyForm && applyPositionId && (
        <ApplyModal
          positionId={applyPositionId}
          positionTitle={positions.find((p) => p.id === applyPositionId)?.title || ""}
          onClose={() => { setShowApplyForm(false); setApplyPositionId(null); }}
        />
      )}
    </div>
  );
}

function ApplyModal({ positionId, positionTitle, onClose }: { positionId: string; positionTitle: string; onClose: () => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
  const [resume, setResume] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.lastName || !form.email) return;
    setSubmitting(true);
    setError("");

    try {
      const fd = new FormData();
      fd.append("firstName", form.firstName);
      fd.append("lastName", form.lastName);
      fd.append("email", form.email);
      fd.append("phone", form.phone);
      fd.append("positionId", positionId);
      if (resume) fd.append("resume", resume);

      const res = await fetch("/api/careers/apply", { method: "POST", body: fd });
      const result = await res.json();

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || "Failed to submit. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {success ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Application Submitted!</h3>
            <p className="text-sm text-gray-500 mb-6">Thanks for applying for <strong>{positionTitle}</strong>. We&apos;ll review your application and get back to you soon.</p>
            <button onClick={onClose} className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-[#3052FF] text-white hover:bg-[#2442dd]">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Apply Now</h3>
                  <p className="text-sm text-gray-500">{positionTitle}</p>
                </div>
                <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      type="text" required value={form.firstName}
                      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#3052FF]/40 focus:border-[#3052FF]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      type="text" required value={form.lastName}
                      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#3052FF]/40 focus:border-[#3052FF]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email" required value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#3052FF]/40 focus:border-[#3052FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel" value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#3052FF]/40 focus:border-[#3052FF]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Resume (PDF)</label>
                  <input
                    type="file" accept=".pdf"
                    onChange={(e) => setResume(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-[#3052FF] hover:file:bg-blue-100"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
              )}
            </div>

            <div className="px-6 sm:px-8 pb-6 sm:pb-8">
              <button
                type="submit"
                disabled={submitting || !form.firstName || !form.lastName || !form.email}
                className="w-full py-3 rounded-xl text-sm font-semibold bg-[#3052FF] text-white hover:bg-[#2442dd] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? "Submitting..." : "Submit Application"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
