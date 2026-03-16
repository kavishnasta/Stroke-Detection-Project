import React, { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Disclaimer } from '../constants/messages';
import { appStyles } from './theme';

type Props = {
  title: string;
  children: ReactNode;
};

export function BaseScreen({ title, children }: Props) {
  return (
    <ScrollView contentContainerStyle={appStyles.screen}>
      <View style={appStyles.card}>
        <Text style={appStyles.title}>{title}</Text>
      </View>
      {children}
      <Text style={appStyles.disclaimer}>{Disclaimer}</Text>
    </ScrollView>
  );
}
