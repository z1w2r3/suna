import { fontWeights } from '@/constants/Fonts';
import { supabase } from '@/constants/SupabaseConfig';
import { useThemedStyles } from '@/hooks/useThemeColor';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Linking,
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
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
    const [showSuccess, setShowSuccess] = useState(false);
    const [successEmail, setSuccessEmail] = useState('');

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
        successContainer: {
            alignItems: 'center' as const,
            padding: 20,
        },
        successIcon: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: '#10B981',
            alignItems: 'center' as const,
            justifyContent: 'center' as const,
            marginBottom: 24,
        },
        successIconText: {
            fontSize: 32,
            color: '#ffffff',
        },
        successTitle: {
            fontSize: 28,
            fontFamily: fontWeights[600],
            color: theme.foreground,
            textAlign: 'center' as const,
            marginBottom: 12,
        },
        successDescription: {
            fontSize: 16,
            color: theme.mutedForeground,
            textAlign: 'center' as const,
            marginBottom: 8,
            lineHeight: 22,
        },
        successEmail: {
            fontSize: 16,
            fontFamily: fontWeights[600],
            color: theme.foreground,
            textAlign: 'center' as const,
            marginBottom: 24,
        },
        successNote: {
            backgroundColor: '#10B98120',
            borderColor: '#10B98140',
            borderWidth: 1,
            borderRadius: 8,
            padding: 16,
            marginBottom: 32,
        },
        successNoteText: {
            fontSize: 14,
            color: '#059669',
            textAlign: 'center' as const,
            lineHeight: 20,
        },
        successButtonContainer: {
            width: '100%' as const,
            gap: 12,
        },
        legalText: {
            fontSize: 12,
            color: theme.mutedForeground,
            textAlign: 'center' as const,
            marginTop: 20,
            lineHeight: 16,
            paddingHorizontal: 8,
        },
        legalLink: {
            color: theme.primary,
        },
    }));

    const handleAuth = async () => {
        if (!email.trim()) {
            Alert.alert('Error', 'Please enter your email');
            return;
        }

        if (mode !== 'forgot' && !password.trim()) {
            Alert.alert('Error', 'Please enter your password');
            return;
        }

        setLoading(true);

        try {
            if (mode === 'signup') {
                if (password !== confirmPassword) {
                    Alert.alert('Error', 'Passwords do not match');
                    return;
                }
                if (password.length < 6) {
                    Alert.alert('Error', 'Password must be at least 6 characters');
                    return;
                }

                const { error } = await supabase.auth.signUp({
                    email: email.trim(),
                    password: password.trim(),
                });

                if (error) {
                    Alert.alert('Sign Up Error', error.message);
                } else {
                    setSuccessEmail(email.trim());
                    setShowSuccess(true);
                }
            } else if (mode === 'forgot') {
                const { error } = await supabase.auth.resetPasswordForEmail(email.trim());

                if (error) {
                    Alert.alert('Error', error.message);
                } else {
                    Alert.alert('Success', 'Check your email for a password reset link');
                    setMode('signin');
                }
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email: email.trim(),
                    password: password.trim(),
                });

                if (error) {
                    if (error.message === 'Email not confirmed') {
                        Alert.alert(
                            'Email Not Confirmed',
                            'Please check your email and click the confirmation link before signing in.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Resend Email',
                                    onPress: async () => {
                                        const { error: resendError } = await supabase.auth.resend({
                                            type: 'signup',
                                            email: email.trim()
                                        });

                                        if (resendError) {
                                            Alert.alert('Error', resendError.message);
                                        } else {
                                            Alert.alert('Success', 'Confirmation email sent! Please check your inbox.');
                                        }
                                    }
                                }
                            ]
                        );
                    } else {
                        Alert.alert('Sign In Error', error.message);
                    }
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
        setConfirmPassword('');
        setMode('signin');
        setShowSuccess(false);
        setSuccessEmail('');
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleBackToSignIn = () => {
        setShowSuccess(false);
        setSuccessEmail('');
        setMode('signin');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
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

                    {showSuccess ? (
                        <View style={styles.successContainer}>
                            <View style={styles.successIcon}>
                                <Text style={styles.successIconText}>✉</Text>
                            </View>

                            <Text style={styles.successTitle}>Check your email</Text>

                            <Text style={styles.successDescription}>
                                We've sent a confirmation link to:
                            </Text>

                            <Text style={styles.successEmail}>{successEmail}</Text>

                            <View style={styles.successNote}>
                                <Text style={styles.successNoteText}>
                                    Click the link in the email to activate your account. If you don't see the email, check your spam folder.
                                </Text>
                            </View>

                            <View style={styles.successButtonContainer}>
                                <TouchableOpacity style={styles.button} onPress={handleBackToSignIn}>
                                    <Text style={styles.buttonText}>Back to Sign In</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.button, { backgroundColor: 'transparent', borderWidth: 1, borderColor: styles.button.backgroundColor }]}
                                    onPress={handleClose}
                                >
                                    <Text style={[styles.buttonText, { color: styles.button.backgroundColor }]}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <>
                            <Text style={styles.title}>
                                {mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Reset Password' : 'Sign In'}
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

                            {mode !== 'forgot' && (
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
                            )}

                            {mode === 'signup' && (
                                <TextInput
                                    style={styles.input}
                                    placeholder="Confirm Password"
                                    placeholderTextColor={styles.closeText.color}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                            )}

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled]}
                                onPress={handleAuth}
                                disabled={loading}
                            >
                                <Text style={styles.buttonText}>
                                    {loading ? 'Loading...' : mode === 'signup' ? 'Sign Up' : mode === 'forgot' ? 'Send Reset Link' : 'Sign In'}
                                </Text>
                            </TouchableOpacity>

                            {mode === 'signin' && (
                                <TouchableOpacity
                                    style={styles.switchButton}
                                    onPress={() => setMode('forgot')}
                                >
                                    <Text style={styles.switchText}>Forgot Password?</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.switchButton}
                                onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
                            >
                                <Text style={styles.switchText}>
                                    {mode === 'signup'
                                        ? 'Already have an account? Sign In'
                                        : mode === 'forgot'
                                            ? 'Back to Sign In'
                                            : 'Need an account? Sign Up'}
                                </Text>
                            </TouchableOpacity>

                            <View>
                                <Text style={styles.legalText}>
                                    By continuing, you agree to our{' '}
                                    <Text
                                        style={styles.legalLink}
                                        onPress={() => Linking.openURL('https://www.suna.so/legal?tab=terms')}
                                    >
                                        Terms of Service
                                    </Text>
                                    {' '}and{' '}
                                    <Text
                                        style={styles.legalLink}
                                        onPress={() => Linking.openURL('https://www.suna.so/legal?tab=privacy')}
                                    >
                                        Privacy Policy
                                    </Text>
                                </Text>
                            </View>
                        </>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}; 