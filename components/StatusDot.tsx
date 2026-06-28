import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusColor } from '../types';
import { Colors } from '../constants/theme';

const colorMap: Record<StatusColor, string> = {
  green: Colors.green,
  orange: Colors.orange,
  red: Colors.red,
  gray: Colors.gray,
};

interface Props {
  status: StatusColor;
  size?: number;
}

export default function StatusDot({ status, size = 10 }: Props) {
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colorMap[status] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { flexShrink: 0 },
});
