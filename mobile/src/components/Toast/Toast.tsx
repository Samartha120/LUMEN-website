import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';

export interface ToastProps {
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
  duration?: number;
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
}) => {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(duration),
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      onDismiss?.();
    });
  }, []);

  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return { icon: 'checkmark-circle', color: theme.colors.success };
      case 'warning':
        return { icon: 'alert-circle', color: theme.colors.warning };
      case 'error':
        return { icon: 'close-circle', color: theme.colors.danger };
      default:
        return { icon: 'information-circle', color: theme.colors.primary };
    }
  };

  const { icon, color } = getIconAndColor();

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={[styles.card, { borderLeftColor: color }]}>
        <Icon name={icon as any} size={20} color={color} />
        <Text style={styles.messageText}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    zIndex: 999,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    gap: 10,
    maxWidth: '100%',
  },
  messageText: {
    color: '#F8FAFC',
    fontSize: theme.typography.sizes.xs,
    fontWeight: '600',
    flex: 1,
  },
});
