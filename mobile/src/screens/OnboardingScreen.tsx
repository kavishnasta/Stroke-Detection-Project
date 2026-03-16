import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { BaseScreen } from '../ui/BaseScreen';
import { appStyles } from '../ui/theme';

type Props = {
  onStart: () => void;
  onLearn: () => void;
};

export function OnboardingScreen({ onStart, onLearn }: Props) {
  return (
    <BaseScreen title="FAST Stroke Check">
      <View style={appStyles.card}>
        <Text style={appStyles.body}>
          This app runs a guided FAST self-check: Face, Arms, and Speech. Use it when stroke signs are suspected and act quickly.
        </Text>
      </View>
      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>FAST</Text>
        <Text style={appStyles.body}>Face drooping</Text>
        <Text style={appStyles.body}>Arm weakness</Text>
        <Text style={appStyles.body}>Speech difficulty</Text>
        <Text style={appStyles.body}>Time to call 911</Text>
      </View>
      <TouchableOpacity style={appStyles.button} onPress={onStart}>
        <Text style={appStyles.buttonText}>Start 3-Step Test</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={onLearn}>
        <Text style={appStyles.buttonText}>Learn About Stroke</Text>
      </TouchableOpacity>
    </BaseScreen>
  );
}
