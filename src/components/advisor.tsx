"use client";
import { useState } from "react";
import { Sparkles, ArrowUp, ShieldCheck, Database } from "lucide-react";
import { toast } from "sonner";
import { useData, api, PageTitle } from "./common";
import { Button } from "./ui/button";
export default function Advisor() {
  const { data } = useData();
  const [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [messages, setMessages] = useState<
      { role: string; content: string; provider?: string }[]
    >([]);
  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setQuestion("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setBusy(true);
    try {
      const r = await api<{ answer: string; provider: string }>("advisor", {
        question: q,
      });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: r.answer, provider: r.provider },
      ]);
    } catch (e) {
      toast.error((e as Error).message);
      setQuestion(q);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR BUSINESS, IN CONTEXT"
        title="AI Advisor"
        description="A second perspective, grounded in your actual records."
      />
      <div className="advisor-layout">
        <section className="chat-panel">
          {!messages.length ? (
            <div className="chat-welcome">
              <span className="ai-orb">
                <Sparkles size={30} />
              </span>
              <h2>Let’s find your next best move.</h2>
              <p>
                Ask about equipment, lead quality, or advertising performance.
                Decisions stay with you.
              </p>
              <div className="suggestions">
                {[
                  "Which campaign brings the most revenue?",
                  "Which machines should I advertise next?",
                  "Which campaigns should I pause?",
                  "เดือนนี้ตัวไหนยิงแอดดีที่สุด",
                ].map((q) => (
                  <button key={q} onClick={() => ask(q)}>
                    {q}
                    <ArrowUp size={15} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chat-messages" aria-live="polite">
              {messages.map((m, i) => (
                <div className={`chat-message ${m.role}`} key={i}>
                  <small>{m.role === "user" ? "You" : m.provider}</small>
                  <p>{m.content}</p>
                </div>
              ))}
              {busy && (
                <div className="chat-message assistant">
                  <span className="pulse-dot" /> Reading business records…
                </div>
              )}
            </div>
          )}
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(question);
            }}
          >
            <textarea
              aria-label="Ask the advisor"
              placeholder="Ask about your business…"
              value={question}
              maxLength={2000}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void ask(question);
                }
              }}
              rows={2}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send question"
              disabled={busy || !question.trim()}
            >
              <ArrowUp size={20} />
            </Button>
          </form>
          <p className="chat-disclaimer">
            {data.aiConfigured
              ? "AI can make mistakes. Review the supporting records."
              : "Demo analyst uses deterministic summaries of saved data; connect OpenAI for open-ended analysis."}
          </p>
        </section>
        <aside className="advisor-aside">
          <h3>
            <Database size={18} />
            Connected context
          </h3>
          <div>
            <span>Reporting period</span>
            <strong>Last 30 days</strong>
          </div>
          <div>
            <span>Inventory</span>
            <strong>{data.items.length} machines</strong>
          </div>
          <div>
            <span>Campaigns</span>
            <strong>{data.campaigns.length} campaigns</strong>
          </div>
          <div>
            <span>Attribution</span>
            <strong>CRM sales & revenue</strong>
          </div>
          <div className="notice">
            <ShieldCheck size={20} />
            <p>
              Read-only by design. The advisor cannot activate, pause, or change
              campaign budgets.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
