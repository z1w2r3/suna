import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Types for UI state
export interface FileDownload {
  id: string;
  localPath: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  error?: string;
}

export interface CurrentTool {
  id: string;
  name: string;
  isActive: boolean;
  data?: Record<string, any>;
}

interface UIState {
  // Chat UI state (discardable on cold start)
  currentTool: CurrentTool | null;
  inputDraft: string;
  isTyping: boolean;
  
  // File management (local device paths + download progress)
  fileDownloads: Map<string, FileDownload>;
  
  // UI preferences (discardable)
  sidebarCollapsed: boolean;
  activePanel: 'chat' | 'files' | 'settings' | null;
  
  // Panel state
  leftPanelVisible: boolean;
  rightPanelVisible: boolean;
  
  // Loading states
  isGenerating: boolean;
  
  // Actions
  setCurrentTool: (tool: CurrentTool | null) => void;
  setInputDraft: (draft: string) => void;
  setIsTyping: (typing: boolean) => void;
  
  addFileDownload: (download: FileDownload) => void;
  updateFileDownload: (id: string, updates: Partial<FileDownload>) => void;
  removeFileDownload: (id: string) => void;
  
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActivePanel: (panel: 'chat' | 'files' | 'settings' | null) => void;
  setIsGenerating: (generating: boolean) => void;
  
  // Panel actions
  setLeftPanelVisible: (visible: boolean) => void;
  setRightPanelVisible: (visible: boolean) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  closePanels: () => void;
  
  // Batch actions for performance
  updateChatState: (updates: {
    currentTool?: CurrentTool | null;
    inputDraft?: string;
    isTyping?: boolean;
    isGenerating?: boolean;
  }) => void;
  
  // Reset actions
  resetChatState: () => void;
  clearFileDownloads: () => void;
}

export const useUIStore = create<UIState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state - all discardable on cold start
    currentTool: null,
    inputDraft: '',
    isTyping: false,
    fileDownloads: new Map(),
    sidebarCollapsed: false,
    activePanel: null,
    leftPanelVisible: false,
    rightPanelVisible: false,
    isGenerating: false,
    
    // Optimized actions with batched updates
    setCurrentTool: (tool) => set({ currentTool: tool }),
    setInputDraft: (draft) => set({ inputDraft: draft }),
    setIsTyping: (typing) => set({ isTyping: typing }),
    
    addFileDownload: (download) => set((state) => {
      const newDownloads = new Map(state.fileDownloads);
      newDownloads.set(download.id, download);
      return { fileDownloads: newDownloads };
    }),
    
    updateFileDownload: (id, updates) => set((state) => {
      const newDownloads = new Map(state.fileDownloads);
      const existing = newDownloads.get(id);
      if (existing) {
        newDownloads.set(id, { ...existing, ...updates });
      }
      return { fileDownloads: newDownloads };
    }),
    
    removeFileDownload: (id) => set((state) => {
      const newDownloads = new Map(state.fileDownloads);
      newDownloads.delete(id);
      return { fileDownloads: newDownloads };
    }),
    
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
    setActivePanel: (panel) => set({ activePanel: panel }),
    setIsGenerating: (generating) => set({ isGenerating: generating }),
    
    // Panel actions
    setLeftPanelVisible: (visible) => set({ leftPanelVisible: visible }),
    setRightPanelVisible: (visible) => set({ rightPanelVisible: visible }),
    toggleLeftPanel: () => set((state) => ({ leftPanelVisible: !state.leftPanelVisible })),
    toggleRightPanel: () => set((state) => ({ rightPanelVisible: !state.rightPanelVisible })),
    closePanels: () => set({ leftPanelVisible: false, rightPanelVisible: false }),
    
    // Batch update for performance
    updateChatState: (updates) => set((state) => ({
      ...state,
      ...updates,
    })),
    
    // Reset actions
    resetChatState: () => set({
      currentTool: null,
      inputDraft: '',
      isTyping: false,
      isGenerating: false,
    }),
    
    clearFileDownloads: () => set({ fileDownloads: new Map() }),
  }))
);

// Specific atomic selectors to prevent infinite loops
export const useCurrentTool = () => useUIStore((state) => state.currentTool);
export const useInputDraft = () => useUIStore((state) => state.inputDraft);
export const useIsGenerating = () => useUIStore((state) => state.isGenerating);
export const useIsTyping = () => useUIStore((state) => state.isTyping);

// Action selectors (these are stable function references)
export const useSetCurrentTool = () => useUIStore((state) => state.setCurrentTool);
export const useSetInputDraft = () => useUIStore((state) => state.setInputDraft);
export const useSetIsGenerating = () => useUIStore((state) => state.setIsGenerating);
export const useSetIsTyping = () => useUIStore((state) => state.setIsTyping);
export const useUpdateChatState = () => useUIStore((state) => state.updateChatState);
export const useResetChatState = () => useUIStore((state) => state.resetChatState);

export const useFileDownloads = () => useUIStore((state) => state.fileDownloads);
export const useAddFileDownload = () => useUIStore((state) => state.addFileDownload);
export const useUpdateFileDownload = () => useUIStore((state) => state.updateFileDownload);
export const useRemoveFileDownload = () => useUIStore((state) => state.removeFileDownload);
export const useClearFileDownloads = () => useUIStore((state) => state.clearFileDownloads);

// Atomic UI layout selectors
export const useSidebarCollapsed = () => useUIStore((state) => state.sidebarCollapsed);
export const useActivePanel = () => useUIStore((state) => state.activePanel);
export const useSetSidebarCollapsed = () => useUIStore((state) => state.setSidebarCollapsed);
export const useSetActivePanel = () => useUIStore((state) => state.setActivePanel);

// Panel selectors
export const useLeftPanelVisible = () => useUIStore((state) => state.leftPanelVisible);
export const useRightPanelVisible = () => useUIStore((state) => state.rightPanelVisible);
export const useSetLeftPanelVisible = () => useUIStore((state) => state.setLeftPanelVisible);
export const useSetRightPanelVisible = () => useUIStore((state) => state.setRightPanelVisible);
export const useToggleLeftPanel = () => useUIStore((state) => state.toggleLeftPanel);
export const useToggleRightPanel = () => useUIStore((state) => state.toggleRightPanel);
export const useClosePanels = () => useUIStore((state) => state.closePanels);

// All selectors above are atomic and safe from infinite loops 