'use client';

import { useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDataStream } from './data-stream-provider';
import type { ChatMessage } from '@/lib/types';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { 
  CopyIcon, 
  CheckIcon, 
  ThumbsUpIcon, 
  ThumbsDownIcon, 
  RefreshCwIcon, 
  SparklesIcon, 
  AlertTriangleIcon,
  ZapIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface RAGAssistantPanelProps {
  messages: ChatMessage[];
  status: any;
  onRegenerate: () => void;
  onClose?: () => void;
}

export function RAGAssistantPanel({
  messages,
  status,
  onRegenerate,
  onClose,
}: RAGAssistantPanelProps) {
  const { dataStream } = useDataStream();
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, 'positive' | 'negative' | 'selected'>>({});

  // Get the latest assistant message
  const lastAssistantMessage = useMemo(() => {
    return [...messages].reverse().find((m) => m.role === 'assistant');
  }, [messages]);

  // Find the latest generation run ID from the stream data
  const generationRunId = useMemo(() => {
    const runIdPart = [...dataStream].reverse().find((p) => p.type === 'data-generation-run-id');
    return runIdPart ? ((runIdPart as any).data as string) : undefined;
  }, [dataStream]);

  // Attempt to parse the message content as JSON
  const parsedData = useMemo(() => {
    if (!lastAssistantMessage?.parts) return null;
    
    const textFromParts = lastAssistantMessage.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part as any).text)
      .join('\n')
      .trim();

    if (!textFromParts) return null;
    
    let text = textFromParts.trim();
    if (text.startsWith('```json')) {
      text = text.substring(7, text.length - 3).trim();
    } else if (text.startsWith('```')) {
      text = text.substring(3, text.length - 3).trim();
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }, [lastAssistantMessage]);

  const handleCopy = async (optionText: string, optionType: string) => {
    try {
      await navigator.clipboard.writeText(optionText);
      setCopiedText(optionText);
      setTimeout(() => setCopiedText(null), 2000);
      toast.success('¡Copiado al portapapeles!');

      if (generationRunId) {
        await fetch('/api/rag/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationRunId,
            optionType,
            optionText,
            feedback: 'copied',
          }),
        });
      }
    } catch (err) {
      toast.error('Error al copiar el texto.');
    }
  };

  const handleFeedback = async (optionText: string, optionType: string, type: 'positive' | 'negative' | 'selected') => {
    const key = `${optionType}-${optionText}`;
    setFeedbacks((prev) => ({ ...prev, [key]: type }));

    if (type === 'selected') {
      toast.success('¡Opción seleccionada!');
    }

    if (generationRunId) {
      try {
        await fetch('/api/rag/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationRunId,
            optionType,
            optionText,
            feedback: type,
          }),
        });
      } catch (err) {
        console.error('Failed to submit feedback:', err);
      }
    }
  };

  const investmentColor = (level: string) => {
    switch ((level || '').toLowerCase()) {
      case 'alta':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'media':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'baja':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default:
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    }
  };

  const optionTypeLabel = (type: string) => {
    switch (type) {
      case 'desafio_teasing':
        return 'Desafío / Teasing';
      case 'intriga_curiosidad':
        return 'Intriga / Curiosidad';
      case 'directa_avance':
        return 'Directa / Avance';
      case 'calibrada_espejo':
        return 'Calibrada / Espejo';
      default:
        return type;
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border select-none">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-sm tracking-tight text-card-foreground">Asistente Coach RAG</h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onClose}>
            Cerrar
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        <AnimatePresence mode="wait">
          {status === 'streaming' && !parsedData ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4 py-8 items-center justify-center text-center"
            >
              <div className="relative flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <ZapIcon className="w-5 h-5 text-primary absolute animate-pulse" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">Analizando conversación...</p>
                <p className="text-xs text-muted-foreground">Extrayendo textos y consultando base vectorial</p>
              </div>
            </motion.div>
          ) : parsedData ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-6"
            >
              {/* Conversational Analysis Card */}
              <div className="p-4 border border-border rounded-xl bg-muted/10 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Lectura Conversacional</span>
                    <h3 className="text-sm font-semibold capitalize text-foreground">
                      Categoría: {parsedData.analysis.category?.replace('_', ' ')}
                    </h3>
                  </div>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 border rounded-full ${investmentColor(parsedData.analysis.apparentInvestment)}`}>
                    Inversión: {parsedData.analysis.apparentInvestment}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {parsedData.analysis.conversationalReading}
                </p>

                {/* Signals */}
                {parsedData.analysis.observedSignals?.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Señales Detectadas</span>
                    <div className="flex flex-wrap gap-1">
                      {parsedData.analysis.observedSignals.map((signal: string) => (
                        <span key={signal} className="text-[10px] bg-secondary/50 text-secondary-foreground px-2 py-0.5 rounded-md border border-border/30">
                          {signal}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risk and Strategy */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/50">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider flex items-center gap-1">
                      <AlertTriangleIcon className="w-3 h-3" /> Riesgo Principal
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-snug">{parsedData.analysis.principalRisk}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1">
                      <SparklesIcon className="w-3 h-3" /> Estrategia
                    </span>
                    <p className="text-[11px] text-muted-foreground leading-snug">{parsedData.analysis.recommendedStrategy}</p>
                  </div>
                </div>
              </div>

              {/* Suggestions List */}
              <div className="flex flex-col gap-3">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Respuestas Sugeridas</span>
                
                {parsedData.options?.map((option: any, index: number) => {
                  const key = `${option.type}-${option.text}`;
                  const feedback = feedbacks[key];

                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }}
                      className="p-4 border border-border rounded-xl bg-background hover:shadow-xs transition-shadow flex flex-col gap-3 group relative"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          {optionTypeLabel(option.type)}
                        </span>
                        {option.intensity && (
                          <span className="text-[9px] uppercase font-semibold text-muted-foreground">
                            Intensidad: {option.intensity}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-medium text-foreground pr-8 select-text leading-relaxed">
                        "{option.text}"
                      </p>

                      <p className="text-[11px] text-muted-foreground italic leading-normal">
                        {option.rationale}
                      </p>

                      {/* Action buttons */}
                      <div className="flex justify-between items-center pt-2 border-t border-border/30 mt-1">
                        <div className="flex gap-1.5">
                          {/* Copy */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs flex gap-1 items-center"
                            onClick={() => handleCopy(option.text, option.type)}
                          >
                            {copiedText === option.text ? (
                              <>
                                <CheckIcon className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Copiado</span>
                              </>
                            ) : (
                              <>
                                <CopyIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>Copiar</span>
                              </>
                            )}
                          </Button>

                          {/* Select */}
                          <Button
                            variant={feedback === 'selected' ? 'secondary' : 'outline'}
                            size="sm"
                            className="h-7 px-2 text-xs flex gap-1 items-center"
                            onClick={() => handleFeedback(option.text, option.type, 'selected')}
                          >
                            <CheckIcon className={`w-3.5 h-3.5 ${feedback === 'selected' ? 'text-primary' : 'text-muted-foreground'}`} />
                            <span>Elegir</span>
                          </Button>
                        </div>

                        {/* Rating */}
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`w-7 h-7 rounded-md ${feedback === 'positive' ? 'bg-emerald-500/10 text-emerald-500' : 'hover:bg-muted text-muted-foreground'}`}
                            onClick={() => handleFeedback(option.text, option.type, 'positive')}
                          >
                            <ThumbsUpIcon className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`w-7 h-7 rounded-md ${feedback === 'negative' ? 'bg-rose-500/10 text-rose-500' : 'hover:bg-muted text-muted-foreground'}`}
                            onClick={() => handleFeedback(option.text, option.type, 'negative')}
                          >
                            <ThumbsDownIcon className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Regenerate Action */}
              <div className="pt-2">
                <Button
                  onClick={onRegenerate}
                  className="w-full flex gap-2 items-center justify-center text-xs h-9 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                >
                  <RefreshCwIcon className="w-3.5 h-3.5" />
                  Regenerar Respuestas
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-4 py-16 items-center justify-center text-center px-4"
            >
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                <SparklesIcon className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1 max-w-[280px]">
                <p className="text-sm font-semibold text-foreground">Sin análisis activo</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Subí capturas de la conversación y escribí una pregunta en el chat para que el coach analice la charla y proponga opciones.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
