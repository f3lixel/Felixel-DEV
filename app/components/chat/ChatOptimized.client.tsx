import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { BaseChat } from './BaseChat';
import { preloadWorkbench } from '../workbench/WorkbenchLazy';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

// Memoized Chat implementation component
const ChatImpl = memo(function ChatImpl({ 
  initialMessages, 
  storeMessageHistory 
}: { 
  initialMessages: Message[]; 
  storeMessageHistory: (messages: Message[]) => void; 
}) {
  renderLogger.trace('ChatImpl');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
  const [animationScope, animate] = useAnimate();
  
  // Intelligent preloading based on user interaction
  const handleFirstInteraction = useCallback(() => {
    if (!chatStarted) {
      // Preload workbench components when user starts typing
      preloadWorkbench();
      setChatStarted(true);
    }
  }, [chatStarted]);

  const {
    messages,
    isLoading,
    input,
    handleInputChange,
    handleSubmit,
    setInput,
    stop,
    append,
  } = useChat({
    api: '/api/chat',
    onError: (error) => {
      logger.error('Request failed\n\n', error);
      toast.error('There was an error processing your request');
    },
    onFinish: (message) => {
      logger.debug('Finished streaming message\n\n', message);
      parseMessages(messages, isLoading, storeMessageHistory);
    },
    initialMessages,
  });

  const { enhancePrompt, isEnhancing } = usePromptEnhancer();
  const { parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  useEffect(() => {
    chatStore.setKey('started', messages.length > 0);
  }, [messages]);

  useEffect(() => {
    parseMessages(messages, isLoading, storeMessageHistory);

    if (messages.length > initialMessages.length) {
      animate('#messages', { opacity: 1 }, { duration: 0.2, ease: cubicEasingFn });
    }
  }, [messages, isLoading, parseMessages, storeMessageHistory, initialMessages.length, animate]);

  const scrollToBottom = useCallback(() => {
    const messagesContainer = document.getElementById('messages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, []);

  useSnapScroll(scrollToBottom);
  useShortcuts();

  // Optimized submit handler with preloading
  const handleOptimizedSubmit = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    const isEnhanceMode = event.nativeEvent?.submitter?.id === 'enhance';

    if (isEnhanceMode) {
      enhancePrompt(input, (enhanced) => {
        if (enhanced) {
          setInput(enhanced);
          append({
            role: 'user',
            content: enhanced,
          });
        }
      });

      return;
    }

    // Preload workbench when user submits their first message
    if (!chatStarted) {
      handleFirstInteraction();
    }

    handleSubmit(event);
  }, [input, enhancePrompt, setInput, append, chatStarted, handleFirstInteraction, handleSubmit]);

  // Optimized input change with preloading trigger
  const handleOptimizedInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(event);
    
    // Trigger preloading on first meaningful input
    if (!chatStarted && event.target.value.length > 10) {
      handleFirstInteraction();
    }
  }, [handleInputChange, chatStarted, handleFirstInteraction]);

  const hasMessages = messages.length > 0;
  const modifier = workbenchStore.running.get() ? 'Shift+' : '';

  return (
    <BaseChat
      ref={animationScope}
      textareaRef={textareaRef}
      input={input}
      handleInputChange={handleOptimizedInputChange}
      handleSubmit={handleOptimizedSubmit}
      isStreaming={isLoading}
      enhanceDisabled={input.length === 0 || isEnhancing}
      promptEnhanced={isEnhancing}
      sendButtonDisabled={input.length === 0 || isLoading}
      messages={messages}
      isEnhancing={isEnhancing}
      hasMessages={hasMessages}
      chatStarted={chatStarted}
      abortRequest={stop}
      TEXTAREA_MAX_HEIGHT={TEXTAREA_MAX_HEIGHT}
      modifier={modifier}
    />
  );
}, (prevProps, nextProps) => {
  // Custom comparison for memo optimization
  return (
    prevProps.initialMessages.length === nextProps.initialMessages.length &&
    prevProps.storeMessageHistory === nextProps.storeMessageHistory
  );
});

export function ChatOptimized() {
  renderLogger.trace('ChatOptimized');

  const { ready, initialMessages, storeMessageHistory } = useChatHistory();

  if (!ready) {
    return <BaseChat isLoading={true} />;
  }

  return (
    <>
      <ChatImpl initialMessages={initialMessages} storeMessageHistory={storeMessageHistory} />
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }
          
          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        closeOnClick
        hideProgressBar
        transition={toastAnimation}
        theme="dark"
        toastClassName="!bg-bolt-elements-background-depth-2 !border !border-bolt-elements-borderColor !text-bolt-elements-textPrimary !rounded-lg"
        bodyClassName="!text-bolt-elements-textPrimary"
      />
    </>
  );
}