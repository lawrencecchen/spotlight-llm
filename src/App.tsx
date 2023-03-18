import { RadioGroup } from "@headlessui/react";
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
import { ModelSchema } from "../server/chatgpt";
import AutosizeTextarea from "./components/AutosizeTextarea";
import { CopyToClipboard } from "./components/CopyToClipboard";
import { LoadingIndicator } from "./components/LoadingIndicator";
import { trpc } from "./utils/trpc";

type ChatSummarizePayload = {
  userInput: string;
  assistantOutput: string;
  apiKey: string;
};

export const MessageItemMarkdown = React.memo(
  function MessageItemMarkdown(props: { text: string }) {
    return (
      <ReactMarkdown
        children={props.text}
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
              overflow: "auto",
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
            return <p className="py-1" {...props} />;
          },
          // links should open in a new tab
          a({ node, ...props }) {
            return <a target="_blank" rel="noopener noreferrer" {...props} />;
          },
        }}
      />
    );
  }
);

export const MessageList = React.memo(
  function MessageList(props: {
    messageIds: string[];
    messages: Record<string, ChatMessage>;
  }) {
    const { messageIds, messages } = props;
    return (
      <>
        {messageIds.map((messageId, i) => {
          const message = messages[messageId];
          return (
            <React.Fragment key={message.id}>
              <div
                className={clsx("px-2", {
                  "text-neutral-400": message.role === "user",
                })}
              >
                <MessageItemMarkdown text={message.text} />
              </div>
              {i !== messageIds.length - 1 && (
                <hr className="my-2 border-neutral-800/90 text-neutral-800 select-none" />
              )}
            </React.Fragment>
          );
        })}
      </>
    );
  },
  function arePropsEqual(oldProps, newProps) {
    if (oldProps.messageIds.length !== newProps.messageIds.length) {
      return false;
    }
    for (let i = 0; i < oldProps.messageIds.length; i++) {
      const oldMessageId = oldProps.messageIds[i];
      const newMessageId = newProps.messageIds[i];
      if (oldMessageId !== newMessageId) {
        return false;
      }
    }
    const oldMessageKeys = Object.keys(oldProps.messages);
    const newMessageKeys = Object.keys(newProps.messages);

    if (oldMessageKeys.length !== newMessageKeys.length) {
      return false;
    }

    for (let i = 0; i < oldMessageKeys.length; i++) {
      const oldMessageKey = oldMessageKeys[i];
      const newMessageKey = newMessageKeys[i];
      const oldMessages = oldProps.messages[oldMessageKey];
      const newMessages = newProps.messages[newMessageKey];
      if (oldMessages.text !== newMessages.text) {
        return false;
      }
    }
    return true;
  }
);

function Chat(props: {
  id: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSuccess?: (opts: ChatSummarizePayload) => void;
}) {
  const [message, setMessage] = useLocalStorage(`message:${props.id}`, "");
  const [openaiApiKey, setOpenaiApiKey] = useLocalStorage<string>(
    `openaiApiKey`,
    ""
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess(data, variables) {
      props.onSuccess?.({
        userInput: variables.message,
        assistantOutput: data.text,
        apiKey: openaiApiKey,
      });
    },
  });
  const [model, setModel] = useLocalStorage<ModelSchema>(
    `defaultmodel`,
    "gpt-3.5-turbo"
  );
  const [conversationId, setConversationId] = useLocalStorage<
    string | undefined
  >(`conversationId:${props.id}`, undefined);
  const [messages, setMessages] = useLocalStorage<Record<string, ChatMessage>>(
    `messages:${props.id}`,
    {}
  );
  // const memoMessages = useMemo(() => messages, []);
  const [messageIds, setMessageIds] = useLocalStorage<string[]>(
    `messageIds:${props.id}`,
    []
  );

  // const memoMessageIds = useMemo(() => messageIds, []);

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
    textareaRef.current?.focus();
  });

  useEffect(() => {
    textareaRef.current?.focus();
  }, [model]);

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
      model,
      apiKey: openaiApiKey,
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
    setTimeout(() => {
      textareaRef.current?.dispatchEvent(new Event("input"));
    }, 0);
    scrollToBottom();
  }
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({});
  }, []);

  const hotkeys: Array<HotkeyItem> = [
    [
      "tab",
      (e) => {
        e.preventDefault();
        setModel(model === "gpt-3.5-turbo" ? "gpt-4" : "gpt-3.5-turbo");
      },
    ],
  ];

  useHotkeys(hotkeys);

  const [apiKeyFocused, setApiKeyFocused] = useState(false);

  return (
    <>
      <div
        className="grow text-white py-2 overflow-auto flex flex-col"
        data-tauri-drag-region
        onWheel={handleWheel}
        onClick={() => {
          setApiKeyFocused(false);
          if (apiKeyFocused) {
            textareaRef.current?.focus?.();
          }
        }}
      >
        {messageIds.length === 0 && (
          <div
            className="self-center justify-self-center grow grid place-content-center w-full text-neutral-400 text-sm cursor-default select-none"
            data-tauri-drag-region
          >
            {/* <div data-tauri-drag-region className="text-center">
              How can I help you?
            </div> */}
            <div className="text-center mt-4">
              <RadioGroup value={model} onChange={setModel} className="mt-2">
                <RadioGroup.Label className="sr-only">
                  {" "}
                  Choose a model{" "}
                </RadioGroup.Label>
                <div className="grid grid-cols-2 gap-2">
                  <RadioGroup.Option
                    value="gpt-3.5-turbo"
                    className={({ active, checked }) =>
                      clsx(
                        "cursor-pointer focus:outline-none",
                        {
                          "bg-neutral-100/80 text-black": checked,
                          "bg-neutral-700/80 text-neutral-300": !checked,
                        },
                        "flex items-center justify-center rounded-md py-1 px-2 text-xs sm:flex-1"
                      )
                    }
                  >
                    <RadioGroup.Label as="span">gpt-3.5-turbo</RadioGroup.Label>
                  </RadioGroup.Option>
                  <RadioGroup.Option
                    value="gpt-4"
                    className={({ active, checked }) =>
                      clsx(
                        "cursor-pointer focus:outline-none",
                        {
                          "bg-neutral-100/80 text-black": checked,
                          "bg-neutral-700/80 text-neutral-300": !checked,
                        },
                        "flex items-center justify-center rounded-md py-1 px-2 text-xs sm:flex-1"
                      )
                    }
                  >
                    <RadioGroup.Label as="span">gpt-4</RadioGroup.Label>
                  </RadioGroup.Option>
                </div>
                <div
                  data-tauri-drag-region
                  className="text-center mt-3 text-xs"
                >
                  <code className="text-[11px]">tab</code> to toggle
                </div>
                <div className="text-center text-xs">
                  <input
                    type={apiKeyFocused ? "text" : "password"}
                    tabIndex={-1}
                    placeholder="OPENAI_API_KEY"
                    value={openaiApiKey}
                    onFocus={() => setApiKeyFocused(true)}
                    onBlur={() => setApiKeyFocused(false)}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    className="border text-neutral-200 bg-neutral-800/80 border-neutral-700/80 px-2 py-0.5 text-xs rounded-lg mt-2"
                  />
                </div>
              </RadioGroup>
            </div>
          </div>
        )}
        <MessageList messageIds={messageIds} messages={messages} />
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
          getHotkeyHandler(hotkeys as any)(e);
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
      createAndGotoNewTab();
    }
  });

  async function handleActiveTabMessageSummary(opts: ChatSummarizePayload) {
    const activeTab = chatTabs.find((tab) => tab.id === activeTabId);
    if (!activeTab) return;
    // if the tab is not named "New chat" then don't update the title
    if (activeTab.title !== "New chat") return;
    const summary = await summarize.mutateAsync(opts);
    if (!summary) return;
    const newTab = {
      ...activeTab,
      title: summary,
    };
    setChatTabs((prev) => {
      const filtered = prev.filter((tab) => tab.id !== activeTab.id);
      return [newTab, ...filtered];
    });
    const iTab = chatTabs.findIndex((tab) => tab.id === activeTab.id);
    scrollTabIndexIntoView(iTab);
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
  function createAndGotoNewTab() {
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
    ["mod+n", createAndGotoNewTab],
    ["mod+t", createAndGotoNewTab],
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
          onClick={createAndGotoNewTab}
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
              data-tauri-drag-region
            >
              <span className="truncate" data-tauri-drag-region>
                {tab.title}
              </span>
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
      </div>
      <Chat
        id={activeTabId}
        key={activeTabId}
        onKeyDown={getHotkeyHandler(hotkeys as any)}
        onSuccess={handleActiveTabMessageSummary}
      />
    </div>
  );
}

export default App;
