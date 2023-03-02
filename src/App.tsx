import { HotkeyItem, getHotkeyHandler, useHotkeys } from "@mantine/hooks";
import { invoke } from "@tauri-apps/api/tauri";
import { type ChatMessage } from "chatgpt";
import clsx from "clsx";
import { Plus, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { materialDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { useEventListener, useLocalStorage } from "usehooks-ts";
import AutosizeTextarea from "./components/AutosizeTextarea";
import { CopyToClipboard } from "./components/CopyToClipboard";
import { LoadingIndicator } from "./components/LoadingIndicator";
import { trpc } from "./utils/trpc";

const promptPrefix = `
You are a 200 IQ thoughtful assistant. Answer as concisely as possible for each response (e.g. don’t be verbose). When it makes sense, use markdown syntax to output code, links, tables, etc. If outputting code, include the programming langugage. Use the examples below as a guide.
`.trim();

function Chat(props: {
  id: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSuccess?: (data: ChatMessage) => void;
}) {
  const [message, setMessage] = useLocalStorage(`message:${props.id}`, "");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess(data) {
      props.onSuccess?.(data);
    },
  });
  const [conversationId, setConversationId] = useLocalStorage<
    string | undefined
  >(`conversationId:${props.id}`, undefined);
  const [messages, setMessages] = useLocalStorage<Record<string, ChatMessage>>(
    `messages:${props.id}`,
    {}
  );
  const [messageIds, setMessageIds] = useLocalStorage<string[]>(
    `messageIds:${props.id}`,
    []
  );
  const userScrolledUp = useRef(false);
  const userScrolling = useRef(false);
  const userScrollingTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  function handleWheel(e: React.UIEvent<HTMLDivElement, UIEvent>) {
    const element = e.currentTarget as HTMLDivElement;
    const maxScrollTop = element.scrollHeight - element.clientHeight;
    const scrollTop = element.scrollTop;
    userScrolledUp.current = scrollTop > 0 && scrollTop < maxScrollTop;
    userScrolling.current = true;
    userScrollingTimeout.current && clearTimeout(userScrollingTimeout.current);
    userScrollingTimeout.current = setTimeout(() => {
      userScrolling.current = false;
    }, 100);
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (!userScrolling.current) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, 0);
  }

  function scrollToBottomIfNotScrolled() {
    if (!userScrolledUp.current && !userScrolling.current) {
      scrollToBottom();
    }
  }

  trpc.chat.onProgress.useSubscription(
    {
      id: props.id,
    },
    {
      onData(data) {
        if (!conversationId && data.conversationId) {
          setConversationId(data.conversationId);
        }
        setMessageIds((prevMessageIds) => {
          const lastMessageId = prevMessageIds?.[prevMessageIds.length - 1];
          if (lastMessageId === data.id) {
            return prevMessageIds;
          }
          return [...prevMessageIds, data.id];
        });
        setMessages((prev) => ({
          ...prev,
          [data.id]: data,
        }));
        scrollToBottomIfNotScrolled();
      },
    }
  );

  useEventListener("focus", () => {
    textareaRef.current?.select();
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, [props.id]);

  async function onSubmit() {
    if (message.trim().length === 0) {
      return;
    } else if (message === "RESET") {
      setMessage("");
      setConversationId(undefined);
      setMessages({});
      setMessageIds([]);
      return;
    } else if (sendMessage.isLoading) {
      return;
    }
    sendMessage.mutate({
      id: props.id,
      message,
      conversationId,
      parentMessageId: sendMessage.data?.id,
    });
    setMessage("");
    const chatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: message,
    } satisfies ChatMessage;
    setMessageIds((prev) => [...prev, chatMessage.id]);
    setMessages((prev) => ({
      ...prev,
      [chatMessage.id]: chatMessage,
    }));
    scrollToBottom();
  }
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({});
  }, []);

  return (
    <>
      <div
        className="grow text-white py-2 overflow-auto flex flex-col"
        data-tauri-drag-region
        onWheel={handleWheel}
      >
        {messageIds.length === 0 && (
          <div
            className="self-center justify-self-center grow grid place-content-center w-full text-neutral-400 text-sm cursor-default select-none"
            data-tauri-drag-region
          >
            How can I help you?
          </div>
        )}
        {messageIds.map((messageId, i) => {
          const message = messages[messageId];
          return (
            <React.Fragment key={message.id}>
              <div
                className={clsx("px-2", {
                  "text-neutral-400": message.role === "user",
                })}
              >
                <ReactMarkdown
                  children={message.text}
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ node, inline, className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const customStyle = {
                        fontSize: "0.8rem",
                        borderRadius: "0px",
                        borderBottomLeftRadius: "0.375rem",
                        borderBottomRightRadius: "0.375rem",
                        marginTop: "0px",
                        display: "block",
                        // backgroundColor: "rgb(35,35,35)",
                      };
                      if (inline) {
                        return <code className="text-sm">{children}</code>;
                      }
                      return (
                        <span className="block flex flex-col rounded-md my-2">
                          <span className="block rounded-t-md flex items-center pl-2 bg-neutral-600 py-0.5 select-none cursor-default">
                            <span className="font-sans text-xs">
                              {match?.[1] || "Code"}
                            </span>
                            <span className="block ml-auto mr-0">
                              <CopyToClipboard content={String(children)} />
                            </span>
                          </span>
                          {match ? (
                            <SyntaxHighlighter
                              style={materialDark as any}
                              children={String(children).replace(/\n$/, "")}
                              language={match[1].toLowerCase()}
                              PreTag="span"
                              customStyle={customStyle}
                              {...props}
                            />
                          ) : (
                            <code
                              className={clsx("px-3 py-2", className)}
                              style={{
                                ...customStyle,
                                backgroundColor: "rgb(35,35,35)",
                              }}
                              {...props}
                            >
                              {children}
                            </code>
                          )}
                        </span>
                      );
                    },
                    // give paragraphs a margin
                    p({ node, ...props }) {
                      return <p className="my-2" {...props} />;
                    },
                  }}
                />
              </div>
              {i !== messageIds.length - 1 && (
                <hr className="my-2 border-neutral-800/90 text-neutral-800 select-none" />
              )}
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} className="translate-y-20 transform"></div>
      </div>
      <div
        className={clsx(
          "absolute right-4 bottom-3.5 inline-block rounded-full border border-neutral-600 backdrop-brightness-150 bg-neutral-900/60 px-2 py-1.5 transition",
          {
            "opacity-0": !sendMessage.isLoading,
            "opacity-100": sendMessage.isLoading,
          }
        )}
        aria-hidden={!sendMessage.isLoading}
      >
        <LoadingIndicator size={6} className="text-neutral-700" />
      </div>
      <AutosizeTextarea
        ref={textareaRef}
        placeholder="`⌘ + t` to start a new chat"
        className="w-full bg-transparent focus:outline-none text-neutral-50 text-xl px-4 pb-2.5 pt-2.5 shrink-0 border-t border-neutral-800/50 placeholder:text-neutral-400"
        rows={1}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={async (e) => {
          props.onKeyDown?.(e);
          if (e.key === "Enter" && !e.shiftKey && message.trim().length > 0) {
            e.preventDefault();
            await onSubmit();
          }
        }}
      />
    </>
  );
}

type ChatTab = {
  id: string;
  title: string;
  createdAt: Date;
  lastFocused: Date;
};

function App() {
  const [chatTabs, setChatTabs] = useLocalStorage<Array<ChatTab>>("chatTabs", [
    {
      id: crypto.randomUUID(),
      title: "New chat",
      createdAt: new Date(),
      lastFocused: new Date(),
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(chatTabs[0].id);
  const summarize = trpc.chat.summarize.useMutation();

  useEffect(() => {
    invoke("init_spotlight_window");
  }, []);

  useEffect(() => {
    const activeTab = chatTabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) return;
    document.title = activeTab.title;
    // update lastFocused
    const newTabs = chatTabs.map((tab) => {
      if (tab.id === activeTabId) {
        return {
          ...tab,
          lastFocused: new Date(),
        };
      }
      return tab;
    });
    setChatTabs(newTabs);
  }, [activeTabId]);

  useEventListener("focus", () => {
    // if tab is more than 1 minute old, create a new one
    const activeTab = chatTabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) return;
    if (activeTab.title !== "New chat") return;
    const diff = new Date().getTime() - activeTab.lastFocused.getTime();
    if (diff > 60 * 1000) {
      createNewTab();
    }
  });

  async function handleActiveTabMessageSummary(chatMessage: ChatMessage) {
    const activeTab = chatTabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) return;
    // if the tab is not named "New chat" then don't update the title
    if (activeTab.title !== "New chat") return;
    const summary = await summarize.mutateAsync({ message: chatMessage.text });
    if (!summary) return;
    const newTab = {
      ...activeTab,
      title: summary,
    };
    setChatTabs((prev) => {
      const filtered = prev.filter((tab) => tab.id !== activeTab.id);
      return [newTab, ...filtered];
    });
  }

  function createNewTab() {
    const newTabId = String(crypto.randomUUID());
    const now = new Date();
    return {
      id: newTabId,
      title: "New chat",
      createdAt: now,
      lastFocused: now,
    };
  }
  function newTab() {
    const newTab = createNewTab();
    setChatTabs((prev) => [newTab, ...prev]);
    setActiveTabId(newTab.id);
  }

  function handleClose(i: number) {
    if (i < 0 || i >= chatTabs.length) return;
    const closedTab = chatTabs[i];
    const filteredTabs = chatTabs.filter((_, j) => j !== i);
    const result = filteredTabs.length === 0 ? [createNewTab()] : filteredTabs;
    setChatTabs(result);
    if (closedTab.id === activeTabId) {
      const newIndex = Math.max(0, Math.min(filteredTabs.length - 1, i));
      setActiveTabId(result[newIndex].id);
    }
  }

  const tabsScrollContainer = useRef<HTMLDivElement>(null);

  function scrollTabIndexIntoView(i: number) {
    const tabContainerEl = tabsScrollContainer.current;
    if (!tabContainerEl) return;
    const tabEl = tabContainerEl.children[i] as HTMLDivElement;
    if (!tabEl) return;
    tabEl.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }

  function nextTab() {
    const index = chatTabs.findIndex((tab) => tab.id === activeTabId);
    if (index === -1) return;
    const nextIndex = (index + 1) % chatTabs.length;
    setActiveTabId(chatTabs[nextIndex].id);
    scrollTabIndexIntoView(nextIndex);
  }

  function prevTab() {
    const index = chatTabs.findIndex((tab) => tab.id === activeTabId);
    if (index === -1) return;
    const nextIndex = (index - 1 + chatTabs.length) % chatTabs.length;
    setActiveTabId(chatTabs[nextIndex].id);
    scrollTabIndexIntoView(nextIndex);
  }

  function commandNumberSetActiveTabId(i: number) {
    if (i === 9) {
      i = chatTabs.length - 1;
    } else if (i === 0) {
      i = 0;
    } else {
      i = i - 1;
    }
    if (i < 0 || i >= chatTabs.length) return;
    setActiveTabId(chatTabs[i].id);
    scrollTabIndexIntoView(i);
  }

  const hotkeys = [
    ["mod+n", newTab],
    ["mod+t", newTab],
    [
      "mod+w",
      () => handleClose(chatTabs.findIndex((tab) => tab.id === activeTabId)),
    ],
    ["mod+shift+]", nextTab],
    ["ctrl+tab", nextTab],
    ["mod+shift+[", prevTab],
    ["ctrl+shift+tab", prevTab],
    ...Array.from({ length: 10 }).map(
      (_, i) => [`mod+${i}`, () => commandNumberSetActiveTabId(i)] as HotkeyItem
    ),
  ] satisfies Array<HotkeyItem>;
  useHotkeys(hotkeys);

  return (
    <div className="h-screen flex flex-col bg-black/30 rounded-[9px] relative overflow-hidden">
      <div
        data-tauri-drag-region
        className="text-white border-b border-neutral-700/90 flex items-center divide-x divide-neutral-700/90 rounded-t-[9px] grow-0 shrink-0"
      >
        <button
          className="p-2 focus:outline-none rounded-tl-[9px] select-none cursor-default"
          onClick={newTab}
        >
          <Plus className="w-4 h-4" />
        </button>
        <div
          className="flex items-center divide-x divide-neutral-700/90 overflow-x-auto"
          ref={tabsScrollContainer}
        >
          {chatTabs.map((tab, i) => (
            <div
              key={tab.id}
              tabIndex={-1}
              role="button"
              className={clsx(
                "text-sm pl-4 pr-1.5 py-1.5 focus:outline-none flex items-center space-x-1.5 cursor-default select-none",
                {
                  "bg-neutral-800": tab.id === activeTabId,
                }
              )}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="truncate">{tab.title}</span>
              <button
                className={clsx(
                  "p-0.5 hover:bg-neutral-700/80 rounded cursor-default",
                  {
                    "opacity-0": chatTabs.length === 1,
                  }
                )}
                aria-hidden={chatTabs.length === 1}
                disabled={chatTabs.length === 1}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose(i);
                }}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        {/* <span className="text-xs">{activeTabId}</span> */}
      </div>
      <Chat
        id={activeTabId}
        key={activeTabId}
        onKeyDown={getHotkeyHandler(hotkeys as any)}
        onSuccess={(chatMessage) => handleActiveTabMessageSummary(chatMessage)}
      />
    </div>
  );
}

export default App;
