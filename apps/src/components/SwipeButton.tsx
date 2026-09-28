import React from 'react';
import { Text, Pressable, StyleSheet } from 'react-native';

interface SwipeButtonProps {
    onSwipeSuccess: () => void;
    title: string;
    backgroundColor?: string;
}

export function SwipeButton({ onSwipeSuccess, title, backgroundColor = '#14532D' }: SwipeButtonProps) {
    return (
        <Pressable
            style={({ pressed }) => [
                styles.container,
                { backgroundColor },
                pressed && { opacity: 0.8 },
            ]}
            onPress={onSwipeSuccess}
        >
            <Text style={styles.title}>{title}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    title: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
