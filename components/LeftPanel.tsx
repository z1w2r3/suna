import { useProjects } from '@/api/project-api';
import { fontWeights } from '@/constants/Fonts';
import { usePanelTopOffset } from '@/constants/SafeArea';
import { useAuth } from '@/hooks/useAuth';
import { useThemedStyles } from '@/hooks/useThemeColor';
import { useIsNewChatMode, useSelectedProject, useSetNewChatMode, useSetSelectedProject } from '@/stores/ui-store';
import { SquarePen } from 'lucide-react-native';
import React from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SkeletonProjects } from './Skeleton';
import { Body, Caption, H3 } from './Typography';

interface LeftPanelProps {
    isVisible: boolean;
    onClose: () => void;
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ isVisible, onClose }) => {
    const insets = useSafeAreaInsets();
    const panelTopOffset = usePanelTopOffset();

    // Use React Query to fetch projects
    const { data: projects = [], isLoading, error } = useProjects();

    // Use auth context
    const { user, signOut } = useAuth();

    // Use zustand for chat state
    const selectedProject = useSelectedProject();
    const setSelectedProject = useSetSelectedProject();
    const isNewChatMode = useIsNewChatMode();
    const setNewChatMode = useSetNewChatMode();

    const styles = useThemedStyles((theme) => ({
        panel: {
            backgroundColor: theme.sidebar,
            width: 300,
            height: '100%' as const,
            paddingTop: panelTopOffset,
            paddingBottom: insets.bottom,
        },
        header: {
            flexDirection: 'row' as const,
            justifyContent: 'space-between' as const,
            alignItems: 'center' as const,
            paddingHorizontal: 20,
            paddingBottom: 0,
        },
        title: {
            color: theme.foreground,
        },
        closeButton: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.mutedWithOpacity(0.1),
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
        },
        scrollContent: {
            flex: 1,
            paddingHorizontal: 22,
        },
        section: {
            marginTop: 24,
        },
        sectionItem: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            marginBottom: 8,
        },
        sectionItemWithBadge: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            justifyContent: 'space-between' as const,
            paddingVertical: 12,
            borderRadius: 10,
            marginBottom: 8,
        },
        sectionItemLeft: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
        },
        sectionIcon: {
            marginRight: 12,
        },
        sectionText: {
            color: theme.foreground,
            fontSize: 15,
            fontFamily: fontWeights[500],
        },
        newBadge: {
            backgroundColor: theme.primary,
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 12,
        },
        newBadgeText: {
            color: theme.background,
            fontSize: 12,
            fontFamily: fontWeights[600],
        },
        tasksHeader: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            justifyContent: 'space-between' as const,
            marginBottom: 8,
        },
        tasksTitle: {
            color: theme.mutedForeground,
            fontSize: 14,
            fontFamily: fontWeights[600],
            textTransform: 'uppercase' as const,
            letterSpacing: 0.5,
        },
        addButton: {
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: theme.mutedWithOpacity(0.2),
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
        },
        taskItem: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            paddingVertical: 10,
            borderRadius: 6,
            marginBottom: 4,
            marginLeft: -12,
            marginRight: -12,
        },
        taskIcon: {
            marginRight: 12,
            opacity: 0.7,
        },
        taskText: {
            color: theme.foreground,
            marginHorizontal: 12,
            fontSize: 15,
            fontFamily: fontWeights[500],
        },
        userSection: {
            marginTop: 'auto' as const,
            paddingTop: 10,
            paddingHorizontal: 20,
            borderTopWidth: 1,
            borderTopColor: theme.border,
        },
        userInfo: {
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            paddingVertical: 12,
        },
        userAvatar: {
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: theme.primary,
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            marginRight: 12,
        },
        userInitial: {
            color: theme.background,
            fontSize: 14,
            fontFamily: fontWeights[600],
        },
        userDetails: {
            flex: 1,
        },
        userName: {
            color: theme.foreground,
            fontSize: 14,
            fontFamily: fontWeights[500],
        },
        userEmail: {
            color: theme.mutedForeground,
            fontSize: 12,
            marginTop: 1,
        },
        errorText: {
            color: theme.destructive,
            fontSize: 14,
            textAlign: 'center' as const,
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        emptyText: {
            color: theme.mutedForeground,
            fontSize: 14,
            textAlign: 'center' as const,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontStyle: 'italic' as const,
        },
        signOutButton: {
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 6,
            backgroundColor: theme.mutedWithOpacity(0.1),
            marginTop: 8,
        },
        signOutText: {
            color: theme.destructive,
            fontSize: 13,
            fontFamily: fontWeights[500],
            textAlign: 'center' as const,
        },
        selectedTaskItem: {
            backgroundColor: theme.mutedWithOpacity(0.1),
            borderRadius: 12,
        },
        selectedTaskText: {
            color: theme.foreground,
        },
    }));

    if (!isVisible) return null;

    // Render tasks section with real project data
    const renderTasksSection = () => {
        if (isLoading) {
            return <SkeletonProjects count={3} />;
        }

        if (error) {
            return (
                <Body style={styles.errorText}>
                    Failed to load projects. Please try again.
                </Body>
            );
        }

        // Combine new chat project with regular projects
        const allProjects = [];

        // Add current selected project if it's from new chat session (temp or real)
        if (isNewChatMode && selectedProject) {
            allProjects.push({
                id: selectedProject.id,
                name: selectedProject.name,
                isNewChat: true,
            });
        }

        // Add regular projects - but skip if already added above to prevent duplicates
        const selectedProjectId = isNewChatMode && selectedProject ? selectedProject.id : null;
        allProjects.push(...projects
            .filter(p => p.id !== selectedProjectId) // Prevent duplicates
            .map(p => ({ ...p, isNewChat: false }))
        );

        if (allProjects.length === 0) {
            return (
                <Body style={styles.emptyText}>
                    No projects found. Create your first project to get started.
                </Body>
            );
        }

        return allProjects.map((project) => (
            <TouchableOpacity
                key={project.id}
                style={[
                    styles.taskItem,
                    selectedProject?.id === project.id && styles.selectedTaskItem
                ]}
                onPress={() => handleProjectSelect(project)}
            >
                <Body style={[
                    styles.taskText,
                    selectedProject?.id === project.id && styles.selectedTaskText
                ]}>
                    {project.name}
                </Body>
            </TouchableOpacity>
        ));
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            onClose();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleProjectSelect = (project: any) => {
        console.log('[LeftPanel] Project selected:', project.name, 'isNewChat:', project.isNewChat);

        // If selecting a real project (not new chat), exit new chat mode
        if (!project.isNewChat && project.id !== 'new-chat-temp') {
            console.log('[LeftPanel] Selecting real project, exiting new chat mode');
            setNewChatMode(false);
        }

        setSelectedProject(project);
        console.log('[LeftPanel] Calling onClose...');
        onClose(); // Close the panel after selection
    };

    // Get user display info
    const getUserDisplayName = () => {
        if (!user?.email) return 'User';
        return user.email.split('@')[0];
    };

    const getUserInitial = () => {
        const name = getUserDisplayName();
        return name.charAt(0).toUpperCase();
    };

    return (
        <View style={styles.panel}>
            <View style={styles.header}>
                <H3 style={styles.title}>Suna</H3>
                <TouchableOpacity
                    onPress={() => {
                        console.log('[LeftPanel] Starting new chat from pen button');
                        setSelectedProject(null); // Clear selected project
                        setNewChatMode(true);
                        onClose();
                    }}
                >
                    <SquarePen size={22} strokeWidth={2} color={styles.title.color} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Agent Playground */}
                {/* <View style={styles.section}>
                    <TouchableOpacity style={styles.sectionItemWithBadge}>
                        <View style={styles.sectionItemLeft}>
                            <Bot size={20} color={styles.sectionText.color} style={styles.sectionIcon} />
                            <Body style={styles.sectionText}>Agent Playground</Body>
                        </View>
                        <View style={styles.newBadge}>
                            <Caption style={styles.newBadgeText}>New</Caption>
                        </View>
                    </TouchableOpacity>
                </View> */}

                {/* Marketplace */}
                {/* <TouchableOpacity style={styles.sectionItemWithBadge}>
                    <View style={styles.sectionItemLeft}>
                        <Store size={20} color={styles.sectionText.color} style={styles.sectionIcon} />
                        <Body style={styles.sectionText}>Marketplace</Body>
                    </View>
                    <View style={styles.newBadge}>
                        <Caption style={styles.newBadgeText}>New</Caption>
                    </View>
                </TouchableOpacity> */}

                {/* Projects (previously Tasks) */}
                <View style={styles.section}>
                    <View style={styles.tasksHeader}>
                        <Caption style={styles.tasksTitle}>Chats</Caption>
                    </View>

                    {renderTasksSection()}
                </View>
            </ScrollView>

            {/* User Section */}
            <View style={styles.userSection}>
                <TouchableOpacity style={styles.userInfo}>
                    <View style={styles.userAvatar}>
                        <Caption style={styles.userInitial}>{getUserInitial()}</Caption>
                    </View>
                    <View style={styles.userDetails}>
                        <Body style={styles.userName}>{getUserDisplayName()}</Body>
                        <Caption style={styles.userEmail}>{user?.email || 'No email'}</Caption>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                    <Caption style={styles.signOutText}>Sign Out</Caption>
                </TouchableOpacity>
            </View>
        </View>
    );
}; 