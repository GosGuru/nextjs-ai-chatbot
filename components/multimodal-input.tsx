'use client';

import type { UIMessage } from 'ai';
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type Dispatch,
  type SetStateAction,
  type ChangeEvent,
  memo,
  useMemo,
} from 'react';
import { toast } from 'sonner';
import { useLocalStorage, useWindowSize } from 'usehooks-ts';

import {
  ArrowUpIcon,
  PaperclipIcon,
  CpuIcon,
  StopIcon,
  ChevronDownIcon,
} from './icons';
import { PreviewAttachment } from './preview-attachment';
import { Button } from './ui/button';
import { SuggestedActions } from './suggested-actions';
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
} from './elements/prompt-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as SelectPrimitive from '@radix-ui/react-select';
import equal from 'fast-deep-equal';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { Attachment, ChatMessage } from '@/lib/types';
import type { AppUsage } from '@/lib/usage';
import { chatModels } from '@/lib/ai/models';
import { saveChatModelAsCookie } from '@/app/(chat)/actions';
import { startTransition } from 'react';
import { Context } from './elements/context';
import { myProvider } from '@/lib/ai/providers';

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  usage,
  controls,
  setControls,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: () => void;
  attachments: Array<Attachment>;
  setAttachments: Dispatch<SetStateAction<Array<Attachment>>>;
  messages: Array<UIMessage>;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  usage?: AppUsage;
  controls?: any;
  setControls?: Dispatch<SetStateAction<any>>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, []);

  const adjustHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const resetHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }
  };

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    'input',
    '',
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || '';
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<Array<string>>([]);

  const submitForm = useCallback(() => {
    window.history.replaceState({}, '', `/chat/${chatId}`);

    sendMessage(
      {
        role: 'user',
        parts: [
          ...attachments.map((attachment) => ({
            type: 'file' as const,
            url: attachment.url,
            name: attachment.name,
            mediaType: attachment.contentType,
          })),
          {
            type: 'text',
            text: input,
          },
        ],
      },
      controls
        ? {
            body: {
              controls,
            },
          }
        : undefined
    );

    setAttachments([]);
    setLocalStorageInput('');
    resetHeight();
    setInput('');

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    controls,
  ]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType: contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (error) {
      toast.error('Failed to upload file, please try again!');
    }
  };

  const modelResolver = useMemo(() => {
    return myProvider.languageModel(selectedModelId);
  }, [selectedModelId]);

  const contextProps = useMemo(
    () => ({
      usage,
    }),
    [usage],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined,
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error('Error uploading files!', error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments],
  );

  return (
    <div className="flex relative flex-col gap-4 w-full">

      {messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            sendMessage={sendMessage}
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}

      {controls && setControls && (
        <div className="p-3 border rounded-xl flex flex-col gap-3 bg-muted/20 border-border shadow-xs">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Configuración de Coach RAG (Español Rioplatense)
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            <div className="flex flex-col gap-1">
              <label htmlFor="platform-select" className="text-[10px] text-muted-foreground uppercase font-medium">Plataforma</label>
              <Select
                value={controls.platform}
                onValueChange={(val) => setControls((c: any) => ({ ...c, platform: val }))}
              >
                <SelectTrigger id="platform-select" className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Plataforma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Tinder">Tinder</SelectItem>
                  <SelectItem value="Bumble">Bumble</SelectItem>
                  <SelectItem value="Instagram">Instagram</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="Happn">Happn</SelectItem>
                  <SelectItem value="Otra">Otra</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="category-select" className="text-[10px] text-muted-foreground uppercase font-medium">Categoría</label>
              <Select
                value={controls.category}
                onValueChange={(val) => setControls((c: any) => ({ ...c, category: val }))}
              >
                <SelectTrigger id="category-select" className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apertura">Apertura</SelectItem>
                  <SelectItem value="shit_test">Shit-Test</SelectItem>
                  <SelectItem value="tension">Tensión</SelectItem>
                  <SelectItem value="chat_frio">Chat Frío</SelectItem>
                  <SelectItem value="concrecion">Concreción</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="objective-select" className="text-[10px] text-muted-foreground uppercase font-medium">Objetivo</label>
              <Select
                value={controls.objective}
                onValueChange={(val) => setControls((c: any) => ({ ...c, objective: val }))}
              >
                <SelectTrigger id="objective-select" className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Objetivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calibrar_charla">Calibrar Charla</SelectItem>
                  <SelectItem value="conseguir_instagram">Conseguir Instagram</SelectItem>
                  <SelectItem value="conseguir_whatsapp">Conseguir WhatsApp</SelectItem>
                  <SelectItem value="pactar_cita">Pactar Cita</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="type-select" className="text-[10px] text-muted-foreground uppercase font-medium">Tipo</label>
              <Select
                value={controls.responseType}
                onValueChange={(val) => setControls((c: any) => ({ ...c, responseType: val }))}
              >
                <SelectTrigger id="type-select" className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="desafio_teasing">Desafío / Teasing</SelectItem>
                  <SelectItem value="intriga_curiosidad">Intriga / Curiosidad</SelectItem>
                  <SelectItem value="directa_avance">Directa / Avance</SelectItem>
                  <SelectItem value="calibrada_espejo">Calibrada / Espejo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="intensity-select" className="text-[10px] text-muted-foreground uppercase font-medium">Intensidad</label>
              <Select
                value={controls.intensity}
                onValueChange={(val) => setControls((c: any) => ({ ...c, intensity: val }))}
              >
                <SelectTrigger id="intensity-select" className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Intensidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suave">Suave</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="extension-select" className="text-[10px] text-muted-foreground uppercase font-medium">Extensión</label>
              <Select
                value={controls.extension}
                onValueChange={(val) => setControls((c: any) => ({ ...c, extension: val }))}
              >
                <SelectTrigger id="extension-select" className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Extensión" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="muy_breve">Muy breve</SelectItem>
                  <SelectItem value="breve">Breve</SelectItem>
                  <SelectItem value="mediana">Mediana</SelectItem>
                  <SelectItem value="larga">Larga</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {controls.objective === 'custom' && (
            <div className="flex flex-col gap-1 mt-1">
              <label htmlFor="custom-goal-input" className="text-[10px] text-muted-foreground uppercase font-medium">Objetivo Personalizado</label>
              <input
                id="custom-goal-input"
                type="text"
                aria-label="Objetivo Personalizado"
                placeholder="Ej. Invitarla a tomar algo este jueves cerca de Palermo"
                className="w-full text-xs p-2 border border-border bg-background rounded-md outline-hidden focus:ring-1 focus:ring-ring focus-visible:outline-hidden"
                value={controls.customGoal || ''}
                onChange={(e) => setControls((c: any) => ({ ...c, customGoal: e.target.value }))}
              />
            </div>
          )}
        </div>
      )}

      <input
        type="file"
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        ref={fileInputRef}
        multiple
        onChange={handleFileChange}
        tabIndex={-1}
      />

      <PromptInput
        className="p-3 rounded-xl border transition-all duration-200 border-border bg-background shadow-xs focus-within:border-border hover:border-muted-foreground/50"
        onSubmit={(event) => {
          event.preventDefault();
          if (status !== 'ready') {
            toast.error('Please wait for the model to finish its response!');
          } else {
            submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            data-testid="attachments-preview"
            className="flex overflow-x-scroll flex-row gap-2 items-end"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                key={attachment.url}
                attachment={attachment}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url),
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                key={filename}
                attachment={{
                  url: '',
                  name: filename,
                  contentType: '',
                }}
                isUploading={true}
              />
            ))}
          </div>
        )}
        <div className="flex flex-row gap-1 items-start sm:gap-2">
          <PromptInputTextarea
            data-testid="multimodal-input"
            ref={textareaRef}
            placeholder="Send a message..."
            value={input}
            onChange={handleInput}
            minHeight={44}
            maxHeight={200}
            disableAutoResize={true}
            className="grow resize-none border-0! p-2 border-none! bg-transparent text-sm outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
            rows={1}
            autoFocus
          />{' '}
          <Context {...contextProps} />
        </div>
        <PromptInputToolbar className="!border-top-0 border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
          <PromptInputTools className="gap-0 sm:gap-0.5">
            <AttachmentsButton
              fileInputRef={fileInputRef}
              status={status}
              selectedModelId={selectedModelId}
            />
            <ModelSelectorCompact selectedModelId={selectedModelId} onModelChange={onModelChange} />
          </PromptInputTools>

          {status === 'submitted' ? (
            <StopButton stop={stop} setMessages={setMessages} />
          ) : (
            <PromptInputSubmit
              status={status}
              disabled={!input.trim() || uploadQueue.length > 0}
              className="rounded-full transition-colors duration-200 size-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground"
            >
              <ArrowUpIcon size={14} />
            </PromptInputSubmit>
          )}
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) return false;
    if (prevProps.status !== nextProps.status) return false;
    if (!equal(prevProps.attachments, nextProps.attachments)) return false;
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
      return false;
    if (prevProps.selectedModelId !== nextProps.selectedModelId) return false;
    if (!equal(prevProps.controls, nextProps.controls)) return false;

    return true;
  },
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>['status'];
  selectedModelId: string;
}) {
  const isReasoningModel = selectedModelId === 'chat-model-reasoning';

  return (
    <Button
      data-testid="attachments-button"
      className="p-1 h-8 rounded-lg transition-colors aspect-square hover:bg-accent"
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      disabled={status !== 'ready' || isReasoningModel}
      variant="ghost"
    >
      <PaperclipIcon size={14} style={{ width: 14, height: 14 }} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId);

  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  const selectedModel = chatModels.find(
    (model) => model.id === optimisticModelId,
  );

  return (
    <PromptInputModelSelect
      value={selectedModel?.name}
      onValueChange={(modelName) => {
        const model = chatModels.find((m) => m.name === modelName);
        if (model) {
          setOptimisticModelId(model.id);
          onModelChange?.(model.id);
          startTransition(() => {
            saveChatModelAsCookie(model.id);
          });
        }
      }}
    >
      <SelectPrimitive.Trigger
        type="button"
        className="flex gap-2 items-center px-2 h-8 rounded-lg border-0 shadow-none transition-colors bg-background text-foreground hover:bg-accent focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        <CpuIcon size={16} />
        <span className="hidden text-xs font-medium sm:block">
          {selectedModel?.name}
        </span>
        <ChevronDownIcon size={16} />
      </SelectPrimitive.Trigger>
      <PromptInputModelSelectContent className="min-w-[260px] p-0">
        <div className="flex flex-col gap-px">
          {chatModels.map((model) => (
            <SelectItem
              key={model.id}
              value={model.name}
              className="px-3 py-2 text-xs"
            >
              <div className="flex flex-col flex-1 gap-1 min-w-0">
                <div className="text-xs font-medium truncate">{model.name}</div>
                <div className="text-[10px] text-muted-foreground truncate leading-tight">
                  {model.description}
                </div>
              </div>
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}) {
  return (
    <Button
      data-testid="stop-button"
      className="p-1 rounded-full transition-colors duration-200 size-7 bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
