import { fontWeights } from '@/constants/Fonts';
import { supabase } from '@/constants/SupabaseConfig';
import { useThemedStyles } from '@/hooks/useThemeColor';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

interface AuthOverlayProps {
    visible: boolean;
    onClose: () => void;
}

export const AuthOverlay: React.FC<AuthOverlayProps> = ({ visible, onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const styles = useThemedStyles((theme) => ({
        overlay: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center' as const,
            alignItems: 'center' as const,
            padding: 20,
        },
        container: {
            backgroundColor: theme.background,
            borderRadius: 12,
            padding: 20,
            width: '100%' as const,
            maxWidth: 400,
            borderWidth: 1,
            borderColor: theme.border,
        },
        title: {
            fontSize: 24,
            fontFamily: fontWeights[600],
            color: theme.foreground,
            textAlign: 'center' as const,
            marginBottom: 20,
        },
        input: {
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
            fontSize: 16,
            color: theme.foreground,
            backgroundColor: theme.background,
        },
        button: {
            backgroundColor: theme.primary,
            borderRadius: 8,
            padding: 12,
            alignItems: 'center' as const,
            marginBottom: 12,
        },
        buttonDisabled: {
            opacity: 0.6,
        },
        buttonText: {
            color: theme.background,
            fontSize: 16,
            fontFamily: fontWeights[600],
        },
        switchButton: {
            alignItems: 'center' as const,
            padding: 8,
        },
        switchText: {
            color: theme.primary,
            fontSize: 14,
            fontFamily: fontWeights[500],
        },
        closeButton: {
            position: 'absolute' as const,
            top: 16,
            right: 16,
            padding: 8,
        },
        closeText: {
            color: theme.mutedForeground,
            fontSize: 18,
            fontFamily: fontWeights[500],
        },
    }));

    const handleAuth = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email: email.trim(),
                    password: password.trim(),
                });

                if (error) {
                    Alert.alert('Sign Up Error', error.message);
                } else {
                    Alert.alert('Success', 'Please check your email to confirm your account');
                    onClose();
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password: password.trim(),
                });

                if (error) {
                    Alert.alert('Sign In Error', error.message);
                } else {
                    onClose();
                }
            }
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setIsSignUp(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.container}>
                    <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
                        <Text style={styles.closeText}>✕</Text>
                    </TouchableOpacity>

                    <Text style={styles.title}>
                        {isSignUp ? 'Create Account' : 'Sign In'}
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={styles.closeText.color}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor={styles.closeText.color}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleAuth}
                        disabled={loading}
                    >
                        <Text style={styles.buttonText}>
                            {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.switchButton}
                        onPress={() => setIsSignUp(!isSignUp)}
                    >
                        <Text style={styles.switchText}>
                            {isSignUp
                                ? 'Already have an account? Sign In'
                                : 'Need an account? Sign Up'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}; 