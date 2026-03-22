import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Sparkles, ShieldAlert, Route, ClipboardCheck, RefreshCw, User } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

const SUGGESTED_PROMPTS = [
  { label: 'Find critical vulns', icon: ShieldAlert, prompt: 'Find all critical vulnerabilities and show their current remediation status' },
  { label: 'Show attack paths', icon: Route, prompt: 'Show me the highest risk attack paths and their blast radius' },
  { label: 'Compliance gaps', icon: ClipboardCheck, prompt: 'What compliance controls are currently failing and what actions are needed?' },
  { label: 'SLA breaches', icon: RefreshCw, prompt: 'Which vulnerabilities have breached their remediation SLA?' },
];

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'msg-init',
    role: 'assistant',
    content: 'Hello! I\'m the Gridwolf AI Copilot. I can help you analyze your security posture, investigate vulnerabilities, trace attack paths, and check compliance status. What would you like to explore?',
    timestamp: new Date().toISOString(),
  },
];

const MOCK_RESPONSES: Record<string, string> = {
  'Find all critical vulnerabilities and show their current remediation status':
    'I found **3 critical vulnerabilities** in your environment:\n\n1. **CVE-2024-38876** - Siemens S7-1500 Authentication Bypass (CVSS 9.8)\n   - Status: Active | Host: PLC-SIEMENS-01\n   - Remediation: Update to firmware v3.1.2\n\n2. **CVE-2024-29104** - Hardcoded Credentials in HMI Application (CVSS 9.1)\n   - Status: Active | Host: HMI-ROCKWELL-01\n   - Remediation: Remove hardcoded creds, use secrets manager\n\n3. **CVE-2024-38876** affects a Level 1 Purdue asset with direct process control. I recommend prioritizing this for immediate patching.',

  'Show me the highest risk attack paths and their blast radius':
    'The highest risk attack path is:\n\n**Internet -> DMZ -> SCADA -> PLC Takeover**\n- Risk Score: 95/100\n- Blast Radius: 24 assets\n- Steps: 5 hops\n- Exploits: CVE-2024-38876, CVE-2024-32015\n\nThis path leverages the firewall DMZ, traverses through the SCADA server, and ultimately reaches the S7-1500 PLC. The authentication bypass vulnerability is the critical enabler.\n\nI recommend segmenting the SCADA-to-PLC network path and patching the PLC firmware as immediate mitigations.',

  'What compliance controls are currently failing and what actions are needed?':
    'Currently **2 compliance controls are failing**:\n\n1. **NIST 800-82 AC-3** - Access Enforcement\n   - Applies to: PLC Firmware Suite (SIMATIC STEP 7)\n   - Issue: No role-based access controls on PLC programming interface\n   - Action: Implement authentication and RBAC on the engineering workstation\n\n2. **NERC CIP-005-7** - Electronic Security Perimeter\n   - Applies to: SCADA HMI Platform\n   - Issue: Insufficient perimeter controls between L2 and L3\n   - Action: Deploy additional firewall rules and enable deep packet inspection\n\nAdditionally, **OWASP V5.1** (Input Validation) is in partial compliance.',

  'Which vulnerabilities have breached their remediation SLA?':
    'Based on SLA policies (Critical: 7d, High: 30d, Medium: 90d), several vulnerabilities have breached:\n\n- **Hardcoded Credentials in HMI** (Critical) - 91 days open, SLA: 7d - **84 days overdue**\n- **DNP3 Buffer Overflow** (High) - 118 days open, SLA: 30d - **88 days overdue**\n- **Insecure Deserialization** (High) - 157 days open, SLA: 30d - **127 days overdue**\n- **Default SNMP Community String** (High) - 267 days open, SLA: 30d - **237 days overdue**\n\nI recommend escalating these to the security team lead and scheduling emergency remediation windows.',
};

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export default function AICopilot() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = MOCK_RESPONSES[text.trim()] ||
        `I've analyzed your query about "${text.trim().slice(0, 50)}". Based on the current data in Gridwolf, here are my findings:\n\n- Your environment has **${Math.floor(Math.random() * 10 + 5)} relevant objects** matching this query\n- Risk assessment indicates **moderate exposure** in this area\n- I recommend reviewing the related objects in the Ontology Explorer for deeper analysis.\n\nWould you like me to drill down into any specific aspect?`;

      const assistantMsg: Message = {
        id: `msg-${Date.now()}-resp`,
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 1200);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-content-primary">AI Copilot</h1>
          <p className="text-sm text-content-secondary">Gridwolf intelligent security assistant</p>
        </div>
        <Badge variant="default" dot className="ml-auto">Online</Badge>
      </div>

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col min-h-0">
        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto space-y-4 p-4">
          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4" />
                </div>
              )}
              <div className={cn('max-w-[70%] rounded-lg px-4 py-3', msg.role === 'user' ? 'bg-accent text-white' : 'bg-surface-hover border border-border-default')}>
                <div className={cn('text-sm whitespace-pre-wrap', msg.role === 'assistant' && 'text-content-primary')}>
                  {msg.content.split('\n').map((line, i) => {
                    const boldReplaced = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    return <p key={i} className={line === '' ? 'h-2' : ''} dangerouslySetInnerHTML={{ __html: boldReplaced }} />;
                  })}
                </div>
                <p className={cn('text-xs mt-1.5', msg.role === 'user' ? 'text-white/60' : 'text-content-tertiary')}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
              {msg.role === 'user' && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/15 text-accent shrink-0 mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="bg-surface-hover border border-border-default rounded-lg px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-content-tertiary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 rounded-full bg-content-tertiary animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 rounded-full bg-content-tertiary animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </CardContent>

        {/* Suggested Prompts */}
        {messages.length <= 1 && (
          <div className="px-4 pb-3 shrink-0">
            <p className="text-xs text-content-secondary mb-2">Suggested prompts</p>
            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED_PROMPTS.map((sp) => {
                const Icon = sp.icon;
                return (
                  <button
                    key={sp.label}
                    onClick={() => sendMessage(sp.prompt)}
                    className="flex items-center gap-2 rounded-lg border border-border-default px-3 py-2.5 text-left hover:bg-surface-hover/50 hover:border-border-hover transition-colors cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-accent shrink-0" />
                    <span className="text-xs font-medium text-content-primary">{sp.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <div className="border-t border-border-default p-3 shrink-0">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Gridwolf AI about your security posture..."
              className="flex-1 rounded-lg border border-border-default bg-bg-secondary px-4 py-2.5 text-sm text-content-primary placeholder:text-content-muted outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/30"
              disabled={isTyping}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!input.trim() || isTyping}
              icon={<Send className="h-4 w-4" />}
            >
              Send
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
