import React, { useRef, useState } from 'react';
import { View, Text, Animated, PanResponder, StyleSheet } from 'react-native';

interface SwipeButtonProps {
    onSwipeSuccess: () => void;
    title: string;
    backgroundColor?: string;
}

export function SwipeButton({ onSwipeSuccess, title, backgroundColor = '#14532D' }: SwipeButtonProps) {
    const pan = useRef(new Animated.ValueXY()).current;
    const [width, setWidth] = useState(300);
    const thumbWidth = 56;
    const [swipeSuccess, setSwipeSuccess] = useState(false);

    const reset = () => {
        setSwipeSuccess(false);
        Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
        }).start();
    };

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !swipeSuccess,
            onPanResponderMove: (e, gestureState) => {
                if (swipeSuccess) return;
                if (gestureState.dx > 0 && gestureState.dx < width - thumbWidth) {
                    pan.setValue({ x: gestureState.dx, y: 0 });
                }
            },
            onPanResponderRelease: (e, gestureState) => {
                if (swipeSuccess) return;
                if (gestureState.dx > width - thumbWidth - 30) {
                    Animated.spring(pan, {
                        toValue: { x: width - thumbWidth, y: 0 },
                        useNativeDriver: false,
                    }).start(() => {
                        setSwipeSuccess(true);
                        onSwipeSuccess();
                        // Automatically reset after 1 second for reusability if needed
                        setTimeout(reset, 1000);
                    });
                } else {
                    Animated.spring(pan, {
                        toValue: { x: 0, y: 0 },
                        useNativeDriver: false,
                    }).start();
                }
            },
        })
    ).current;

    return (
        <View
            style={[styles.container, { backgroundColor }]}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        >
            <Text style={styles.title}>{title}</Text>
            <Animated.View
                style={[styles.thumb, { transform: [{ translateX: pan.x }] }]}
                {...panResponder.panHandlers}
            >
                <Text style={styles.thumbText}>{">>"}</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        marginVertical: 4,
    },
    title: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    thumb: {
        position: 'absolute',
        left: 2,
        top: 2,
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 4,
    },
    thumbText: {
        color: '#333',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
