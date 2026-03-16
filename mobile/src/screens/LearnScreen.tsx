import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { BaseScreen } from '../ui/BaseScreen';
import { appStyles } from '../ui/theme';

type Props = {
  onBack: () => void;
};

export function LearnScreen({ onBack }: Props) {
  return (
    <BaseScreen title="Learn About Stroke">
      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>Warning Signs</Text>
        <Text style={appStyles.body}>Sudden facial droop, arm weakness, speech trouble, dizziness, confusion, severe headache.</Text>
      </View>
      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>Risk Factors</Text>
        <Text style={appStyles.body}>High blood pressure, diabetes, smoking, atrial fibrillation, high cholesterol, inactivity.</Text>
      </View>
      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>Emergency Numbers</Text>
        <Text style={appStyles.body}>United States: 911</Text>
        <Text style={appStyles.body}>Add region-specific numbers for global deployments.</Text>
      </View>
      <TouchableOpacity style={appStyles.button} onPress={onBack}>
        <Text style={appStyles.buttonText}>Back</Text>
      </TouchableOpacity>
    </BaseScreen>
  );
}
