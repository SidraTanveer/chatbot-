"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage, type FileUIPart } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Archive,
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  Copy,
  Compass,
  Cpu,
  Download,
  LoaderCircle,
  LogIn,
  MessageSquare,
  Settings,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Share2,
  Square,
  UserPlus,
  User,
  LogOut,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ChatModel } from "@/lib/models";

const starterPrompts = [
  { title: "Build a feature", detail: "Create a React component with tests" },
  { title: "Analyze a problem", detail: "Break down a complex technical task" },
  { title: "Review my code", detail: "Find bugs and suggest improvements" },
  { title: "Plan a project", detail: "Turn an idea into an implementation plan" },
];

function TextMessage({ message }: { message: UIMessage }) {
  return (
    <div className="space-y-2">
      {message.parts.map((part, index) =>
        part.type === "text" ? (
          <div key={index} className="markdown-body leading-7 text-[15px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
          </div>
        ) : null,
      )}
    </div>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("auto");
  const [fileParts, setFileParts] = useState<FileUIPart[]>([]);
  const [attachmentNames, setAttachmentNames] = useState<string[]>([]);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [account, setAccount] = useState<{ id: string; email: string; display_name: string } | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const [userId, setUserId] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelId, setModelId] = useState("auto");
  const [models, setModels] = useState<ChatModel[]>([]);
  const [modelQuery, setModelQuery] = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: {
          modelId,
          mode,
          userId,
          conversationId,
          attachments: fileParts.map((file) => ({
            name: file.filename,
            type: file.mediaType,
            text: file.mediaType.startsWith("text/") ? undefined : undefined,
          })),
        },
      }),
    [modelId, mode, userId, conversationId, fileParts],
  );
  const { messages, sendMessage, status, stop, setMessages, error } = useChat({
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;
  const selectedModel = models.find((model) => model.id === modelId);
  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase();
    if (!query) return models;
    return models.filter((model) =>
      `${model.name} ${model.provider} ${model.id}`.toLowerCase().includes(query),
    );
  }, [modelQuery, models]);

  useEffect(() => {
    let active = true;
    fetch("/api/models")
      .then(async (response) => {
        const data = (await response.json()) as {
          models?: ChatModel[];
          defaultModel?: string;
          error?: string;
        };
        if (!response.ok || !data.models) {
          throw new Error(data.error || "Could not load models.");
        }
        if (!active) return;
        setModels(data.models);
        setModelsError("");
      })
      .catch(() => {
        if (active) setModelsError("Models could not be loaded. Refresh to try again.");
      })
      .finally(() => {
        if (active) setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/auth")
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        if (data.user) {
          setAccount(data.user);
          setUserId(data.user.id);
        } else {
          let currentUserId = window.localStorage.getItem("nexora-user-id");
          if (!currentUserId) {
            currentUserId = crypto.randomUUID();
            window.localStorage.setItem("nexora-user-id", currentUserId);
          }
          setUserId(currentUserId);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function chooseModel(model: ChatModel) {
    setModelId(model.id);
    window.localStorage.setItem("nexora-model", model.id);
    setModelMenuOpen(false);
    setModelQuery("");
  }

  const conversationTitle = useMemo(() => {
    const firstUser = messages.find((message) => message.role === "user");
    if (!firstUser) return "New conversation";
    const text = firstUser.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join(" ");
    return text.length > 28 ? `${text.slice(0, 28)}…` : text;
  }, [messages]);

  function submitMessage(text: string) {
    const message = text.trim();
    if (!message || isBusy) return;
    if (!conversationId) setConversationId(crypto.randomUUID());
    if (mode === "image") {
      setInput("");
      void fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: message }),
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Image generation failed.");
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              parts: [
                { type: "text", text: `![Generated image](${data.url})` },
              ],
            },
          ]);
        })
        .catch((imageError: Error) => {
          setMessages((current) => [
            ...current,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              parts: [{ type: "text", text: `Image generation unavailable: ${imageError.message}` }],
            },
          ]);
        });
      return;
    }
    if (userId) {
      const normalized = message.toLowerCase();
      const tone = /formal|professional/.test(normalized)
        ? "professional"
        : /creative|fun|playful/.test(normalized)
          ? "creative"
          : "balanced";
      const style = /detailed|thorough|long/.test(normalized)
        ? "detailed"
        : /concise|short|brief/.test(normalized)
          ? "concise"
          : "adaptive";
      void fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, tone, style }),
      }).catch(() => undefined);
    }
    sendMessage({ text: message, files: fileParts });
    setInput("");
    setFileParts([]);
    setAttachmentNames([]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitMessage(input);
  }

  function startNewChat() {
    stop();
    setMessages([]);
    setInput("");
    setConversationId("");
    setSidebarOpen(false);
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authMode,
          name: authName,
          email: authEmail,
          password: authPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Authentication failed.");
      setAccount(data.user);
      setUserId(data.user.id);
      window.localStorage.setItem("nexora-user-id", data.user.id);
      setAuthOpen(false);
      setAuthPassword("");
    } catch (authCatchError) {
      setAuthError(authCatchError instanceof Error ? authCatchError.message : "Authentication failed.");
    }
  }

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => undefined);
    setAccount(null);
    const anonymousId = crypto.randomUUID();
    window.localStorage.setItem("nexora-user-id", anonymousId);
    setUserId(anonymousId);
  }

  async function exportResponse(format: "pdf" | "docx" | "xlsx" | "csv" | "md" | "txt" | "json") {
    const assistantText = messages
      .filter((message) => message.role === "assistant")
      .flatMap((message) => message.parts)
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n\n");
    if (!assistantText) return;
    const response = await fetch("/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: assistantText, format }),
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nexora-response.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function messageText(message: UIMessage) {
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
  }

  async function copyResponse(message: UIMessage) {
    await navigator.clipboard.writeText(messageText(message));
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId(""), 1800);
  }

  async function shareResponse(message: UIMessage) {
    const text = messageText(message);
    if (navigator.share) {
      await navigator.share({ title: "Nexora response", text }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(text);
    setCopiedMessageId(message.id);
    window.setTimeout(() => setCopiedMessageId(""), 1800);
  }

  function editPreviousPrompt(messageIndex: number) {
    for (let index = messageIndex - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        setInput(messageText(messages[index]));
        return;
      }
    }
  }

  function attachFile() {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.multiple = true;
    picker.accept = ".txt,.md,.csv,.json,.js,.ts,.tsx,.py,.css,.html,.pdf,image/*,audio/*";
    picker.onchange = async () => {
      const files = Array.from(picker.files || []).slice(0, 4);
      const parts: FileUIPart[] = [];
      const names: string[] = [];
      for (const file of files) {
        if (file.size > 10 * 1024 * 1024) continue;
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(file);
        });
        parts.push({
          type: "file",
          mediaType: file.type || "application/octet-stream",
          filename: file.name,
          url: dataUrl,
        });
        names.push(file.name);
        if (file.type.startsWith("text/") || /\.(txt|md|csv|json|js|ts|tsx|py|css|html)$/i.test(file.name)) {
          const content = await file.text();
          setInput((current) =>
            `${current}${current ? "\n\n" : ""}File: ${file.name}\n\`\`\`\n${content.slice(0, 12000)}\n\`\`\``,
          );
        }
      }
      setFileParts((current) => [...current, ...parts].slice(0, 4));
      setAttachmentNames((current) => [...current, ...names].slice(0, 4));
    };
    picker.click();
  }

  return (
    <main className="flex h-dvh overflow-hidden bg-[#f7f7f5] text-[#4327c1]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[320px] flex-col border-r border-[#4327c1]/[0.06] bg-[#eeeee9] p-3 text-[18px] transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-12 items-center justify-between px-2">
          <button className="flex items-center gap-2 font-semibold" onClick={startNewChat}>
            <span className="grid size-8 place-items-center rounded-lg bg-[#4327c1] text-white"><Bot size={18} /></span>
            <span style={{ fontFamily: "var(--font-space-grotesk)" }} className="text-4xl font-bold text-[#4327c1]">Nexora</span>
          </button>
          <button aria-label="Close menu" className="icon-button lg:hidden" onClick={() => setSidebarOpen(false)}><MoreHorizontal size={18} /></button>
        </div>

        <button className="mt-2 flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition hover:bg-[#4327c1]/[0.05]" onClick={startNewChat}>
          <Plus size={18} /> New conversation
        </button>
        <button className="flex h-11 items-center gap-3 rounded-xl px-3 text-sm text-[#60605c] transition hover:bg-[#4327c1]/[0.05]">
          <Search size={18} /> Search
        </button>

        <div className="mt-5 flex-1 overflow-y-auto">
          {hasMessages && (
            <>
              <p className="px-3 pb-2 text-xs font-medium text-[#85857f]">Today</p>
              <button className="flex w-full items-center gap-3 rounded-xl bg-[#4327c1]/[0.055] px-3 py-2.5 text-left text-sm">
                <MessageSquare size={16} className="shrink-0 text-[#777770]" />
                <span className="truncate">{conversationTitle}</span>
              </button>
            </>
          )}
        </div>

        <div className="space-y-1 border-t border-[#4327c1]/[0.06] pt-2">
          <button className="nav-button"><Compass size={18} /> Explore</button>
          <button className="nav-button"><Archive size={18} /> Archive</button>
          <button type="button" className="nav-button"><Settings size={18} /> Settings</button>
          {account ? (
            <button onClick={signOut} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
              <span className="grid size-8 place-items-center rounded-full bg-[#d7d7cf]"><User size={16} /></span>
              <span className="min-w-0 flex-1 truncate text-left">{account.display_name || account.email}</span>
              <LogOut size={16} className="text-[#777770]" />
            </button>
          ) : (
            <button onClick={() => setAuthOpen(true)} className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
              <span className="grid size-8 place-items-center rounded-full bg-[#d7d7cf]"><User size={16} /></span>
              <span>Sign in / Sign up</span>
            </button>
          )}
        </div>
      </aside>

      {sidebarOpen && <button aria-label="Close sidebar" className="fixed inset-0 z-30 bg-[#4327c1]/20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <section className="flex h-full min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <button aria-label="Open menu" className="flex h-10 items-center rounded-lg px-2 text-xs font-medium text-[#777770] hover:bg-[#4327c1]/[0.05] lg:hidden" onClick={() => setSidebarOpen(true)}>Menu</button>
            <div className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={modelMenuOpen}
                onClick={() => setModelMenuOpen((open) => !open)}
                className="flex max-w-[min(70vw,340px)] items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold hover:bg-[#4327c1]/[0.04]"
              >
                <Cpu size={16} className="model-routing-icon shrink-0 text-[#777770]" />
<span className="truncate text-lg">
                  {modelId === "auto"
                    ? "Smart model routing"
                    : selectedModel?.name || "Choose a model"}
                </span>
                <ChevronDown size={14} className="shrink-0 text-[#777770]" />
              </button>
              {modelMenuOpen && (
                <div className="absolute left-0 top-full z-50 mt-2 w-[min(380px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[#4327c1]/10 bg-white shadow-xl">
                  <div className="border-b border-[#4327c1]/[0.07] p-3">
                    <p className="mb-2 text-xs font-medium text-[#777770]">
                      {models.length} chat models · {new Set(models.map((model) => model.provider)).size} providers
                    </p>
                    <input
                      autoFocus
                      value={modelQuery}
                      onChange={(event) => setModelQuery(event.target.value)}
                      placeholder="Search models or providers"
                      aria-label="Search models"
                      className="w-full rounded-xl border border-[#4327c1]/[0.09] bg-[#f7f7f5] px-3 py-2 text-sm outline-none focus:border-[#4327c1]/25"
                    />
                  </div>
                  <div role="listbox" aria-label="Available AI models" className="max-h-[55dvh] overflow-y-auto p-1.5">
                    <button
                      type="button"
                      role="option"
                      aria-selected={modelId === "auto"}
                      onClick={() => {
                        setModelId("auto");
                        window.localStorage.setItem("nexora-model", "auto");
                        setModelMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#f3f3f0]"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#4327c1] text-white"><Cpu size={14} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">Smart model routing</span>
                        <span className="block truncate text-xs text-[#85857f]">Automatically chooses the best model for each prompt</span>
                      </span>
                      {modelId === "auto" && <Check size={16} className="shrink-0" />}
                    </button>
                    {modelsLoading && (
                      <p className="flex items-center gap-2 px-3 py-4 text-sm text-[#777770]">
                        <LoaderCircle size={16} className="animate-spin" /> Loading models…
                      </p>
                    )}
                    {modelsError && <p className="px-3 py-4 text-sm text-red-700">{modelsError}</p>}
                    {!modelsLoading && !modelsError && filteredModels.length === 0 && (
                      <p className="px-3 py-4 text-sm text-[#777770]">No matching models found.</p>
                    )}
                    {filteredModels.map((model) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={model.id === modelId}
                        key={model.id}
                        onClick={() => chooseModel(model)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[#f3f3f0]"
                      >
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#eeeee9] text-[#60605c]"><Cpu size={14} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{model.name}</span>
                          <span className="block truncate text-xs text-[#85857f]">{model.provider} · {model.id}</span>
                        </span>
                        {model.id === modelId && <Check size={16} className="shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {account ? (
              <button type="button" onClick={signOut} className="flex h-10 items-center gap-2 rounded-full border border-[#4327c1]/[0.08] bg-white px-3.5 text-sm font-medium shadow-sm transition hover:border-[#4327c1]/20">
                <LogOut size={16} /><span>Sign out</span>
              </button>
            ) : (
              <>
                <button type="button" onClick={() => { setAuthMode("signin"); setAuthOpen(true); }} className="flex h-10 items-center gap-2 rounded-full border border-[#4327c1]/[0.08] bg-white px-3.5 text-sm font-medium shadow-sm transition hover:border-[#4327c1]/20">
                  <LogIn size={16} className="rounded" /><span className="text-lg">Login</span>
                </button>
                <button type="button" onClick={() => { setAuthMode("signup"); setAuthOpen(true); }} className="flex h-10 items-center gap-2 rounded-full bg-[#4327c1] px-3.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#35209a]">
                  <UserPlus size={16} className="rounded" /><span className="text-lg">Sign up</span>
                </button>
              </>
            )}
          </div>
        </header>

        {!hasMessages ? (
          <div className="mx-[300px] mr-[300px] flex h-[857.598px] w-[857.598px] max-w-[1001px] flex-1 flex-col items-center justify-evenly px-5 pb-28 text-2xl md:px-8">
            <div className="mb-8">
<div className="mb-5 grid size-11 place-items-center rounded-2xl bg-[#4327c1] text-white"><Bot size={23} className="rounded" /></div>
              <h1 className="font-[system-ui] text-[48px] font-semibold tracking-tight text-[#4327c1]">How can I help you?</h1>
            </div>
            <div className="grid gap-3 text-[#4327c1] sm:grid-cols-2">
              {starterPrompts.map((prompt) => (
                <button key={prompt.title} onClick={() => submitMessage(`${prompt.title}: ${prompt.detail}`)} className="group rounded-2xl border border-[#4327c1]/[0.08] bg-white p-4 text-left shadow-[0_1px_2px_rgba(0,0,0,.03)] transition hover:-translate-y-0.5 hover:border-[#4327c1]/[0.14] hover:shadow-md">
                  <span className="block text-base font-semibold">{prompt.title}</span>
                  <span className="mt-1 block text-sm text-[#777770]">{prompt.detail}</span>
                </button>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[#4327c1]">
              {["auto", "creative", "deep", "code", "plan", "image"].map((choice) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setMode(choice)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
                    mode === choice
                      ? "border-[#4327c1] bg-[#4327c1] text-white"
                      : "border-[#4327c1]/[0.08] bg-white text-[#777770] hover:border-[#4327c1]/20"
                  }`}
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pb-8 md:px-8">
            <div className="mx-auto w-full max-w-3xl space-y-7 py-6">
              {messages.map((message, messageIndex) => (
                <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role !== "user" && <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#4327c1] text-white"><Bot size={16} /></span>}
                  <div className={message.role === "user" ? "max-w-[82%] rounded-2xl rounded-br-md bg-[#e8e8e3] px-4 py-3" : "max-w-[82%] pt-1"}>
                    <TextMessage message={message} />
                    {message.role === "assistant" && (
                      <div className="mt-3 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => copyResponse(message)}
                          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-[#777770] transition hover:bg-[#4327c1]/[0.05] hover:text-[#4327c1]"
                          aria-label="Copy response"
                        >
                          {copiedMessageId === message.id ? <Check size={14} /> : <Copy size={14} />}
                          {copiedMessageId === message.id ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          onClick={() => editPreviousPrompt(messageIndex)}
                          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-[#777770] transition hover:bg-[#4327c1]/[0.05] hover:text-[#4327c1]"
                          aria-label="Edit prompt"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => shareResponse(message)}
                          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-[#777770] transition hover:bg-[#4327c1]/[0.05] hover:text-[#4327c1]"
                          aria-label="Share response"
                        >
                          <Share2 size={14} /> Share
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {status === "submitted" && <div className="flex items-center gap-3 text-sm text-[#777770]"><span className="grid size-8 place-items-center rounded-full bg-[#4327c1] text-white"><Bot size={16} /></span><span className="thinking-dots">Thinking</span></div>}
              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">Unable to connect to the AI provider. Add an AI Gateway key to <code>.env.local</code>.</div>}
            </div>
          </div>
        )}

        <div className="shrink-0 px-4 pb-4 md:px-8 md:pb-6">
          {attachmentNames.length > 0 && (
            <div className="mx-auto mb-2 flex max-w-3xl flex-wrap gap-2">
              {attachmentNames.map((name) => (
                <span key={name} className="rounded-full border border-[#4327c1]/[0.08] bg-white px-3 py-1 text-xs text-[#666660]">{name}</span>
              ))}
            </div>
          )}
          <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-end">
          <form onSubmit={handleSubmit} className="flex min-h-[58px] min-w-0 flex-1 items-end rounded-[26px] border border-[#4327c1]/[0.09] bg-white px-2.5 py-2 shadow-[0_6px_24px_rgba(0,0,0,.08)] focus-within:border-[#4327c1]/[0.16]">
            <button type="button" onClick={attachFile} aria-label="Attach file" className="mb-1 grid size-10 shrink-0 place-items-center rounded-full text-[#777770] transition hover:bg-[#4327c1]/[0.05] hover:text-[#4327c1]"><Paperclip size={19} /></button>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitMessage(input);
                }
              }}
              placeholder="Ask Nexora anything"
              rows={1}
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[15px] outline-none placeholder:text-[#9a9a94]"
            />
            {isBusy ? (
              <button type="button" onClick={stop} aria-label="Stop response" className="mb-1 grid size-10 shrink-0 place-items-center rounded-full bg-[#4327c1] text-white"><Square size={15} fill="currentColor" /></button>
            ) : (
              <button type="submit" disabled={!input.trim()} aria-label="Send message" className="mb-1 grid size-10 shrink-0 place-items-center rounded-full bg-[#4327c1] text-white transition disabled:cursor-not-allowed disabled:bg-[#deded8] disabled:text-[#9a9a94]"><ArrowUp size={19} /></button>
            )}
          </form>

          </div>
          {hasMessages && (
            <div className="mx-auto mt-2 flex max-w-3xl flex-wrap justify-center gap-1.5">
              {(["pdf", "docx", "xlsx", "csv", "md", "txt", "json"] as const).map((format) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => exportResponse(format)}
                  className="flex items-center gap-1 rounded-full border border-[#4327c1]/[0.07] bg-white px-2.5 py-1 text-[11px] font-medium text-[#777770] hover:border-[#4327c1]/15"
                >
                  <Download size={11} /> {format.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-center text-sm text-[#999990]">Nexora can make mistakes. Check important information.</p>
        </div>
      </section>
      {authOpen && (
        <div className="fixed right-4 top-16 z-[70] w-[min(380px,calc(100vw-2rem))]">
          <form onSubmit={submitAuth} className="w-full rounded-[28px] border border-[#4327c1]/10 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#888881]">Nexora account</p>
                <h2 className="mt-1 text-2xl font-semibold">{authMode === "signup" ? "Create account" : "Welcome back"}</h2>
              </div>
              <button type="button" onClick={() => setAuthOpen(false)} className="icon-button" aria-label="Close"><MoreHorizontal size={18} /></button>
            </div>
            {authMode === "signup" && (
              <input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Display name" className="mb-3 w-full rounded-xl border border-[#4327c1]/10 px-4 py-3 text-sm outline-none focus:border-[#4327c1]/30" />
            )}
            <input type="email" required value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email address" className="mb-3 w-full rounded-xl border border-[#4327c1]/10 px-4 py-3 text-sm outline-none focus:border-[#4327c1]/30" />
            <input type="password" required minLength={8} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password (8+ characters)" className="mb-3 w-full rounded-xl border border-[#4327c1]/10 px-4 py-3 text-sm outline-none focus:border-[#4327c1]/30" />
            {authError && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{authError}</p>}
            <button type="submit" className="w-full rounded-xl bg-[#4327c1] px-4 py-3 text-sm font-semibold text-white">
              {authMode === "signup" ? "Create account" : "Sign in"}
            </button>
            <button type="button" onClick={() => setAuthMode((current) => current === "signin" ? "signup" : "signin")} className="mt-3 w-full text-center text-xs text-[#777770]">
              {authMode === "signin" ? "New to Nexora? Create an account" : "Already have an account? Sign in"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
