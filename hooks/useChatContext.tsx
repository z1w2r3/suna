import { Project } from '@/api/project-api';
import React, { createContext, ReactNode, useContext, useState } from 'react';

interface ChatContextType {
    selectedProject: Project | null;
    setSelectedProject: (project: Project | null) => void;
    clearSelection: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
    children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    const clearSelection = () => {
        setSelectedProject(null);
    };

    const value: ChatContextType = {
        selectedProject,
        setSelectedProject,
        clearSelection,
    };

    return (
        <ChatContext.Provider value={value}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChatContext = (): ChatContextType => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error('useChatContext must be used within a ChatProvider');
    }
    return context;
}; 