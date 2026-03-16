import React from 'react';
import { Linking, Share, Text, TouchableOpacity, View } from 'react-native';
import { EmergencyReminder } from '../constants/messages';
import { combineOverallSeverity, overallSummaryText, testResultLabel } from '../flow/fastFlow';
import { createShareableSummary } from '../storage/historyStorage';
import { FastSessionResult, Severity } from '../types/landmarks';
import { BaseScreen } from '../ui/BaseScreen';
import { appStyles } from '../ui/theme';

type Props = {
  result: FastSessionResult;
  onRetake: () => void;
  onSave: () => Promise<void>;
};

function iconForSeverity(severity: Severity): string {
  if (severity === 'green') return '🟢';
  if (severity === 'yellow') return '🟡';
  return '🔴';
}

export function ResultsScreen({ result, onRetake, onSave }: Props) {
  const overall = combineOverallSeverity(result.face.severity, result.arm.severity, result.speech.severity);
  const summary = overallSummaryText(result.face.severity, result.arm.severity, result.speech.severity);

  const share = async () => {
    const message = createShareableSummary(result);
    await Share.share({ message });
  };

  const callEmergency = async () => {
    await Linking.openURL('tel:911');
  };

  return (
    <BaseScreen title="Results">
      <View style={appStyles.card}>
        <Text style={appStyles.subtitle}>{iconForSeverity(overall)} Overall risk level</Text>
        <Text style={appStyles.body}>{summary}</Text>
      </View>

      <View style={appStyles.card}>
        <Text style={appStyles.body}>{testResultLabel('Face', result.face.severity, 'Asymmetry detected')}</Text>
        <Text style={appStyles.body}>{testResultLabel('Arms', result.arm.severity, 'One arm drifted')}</Text>
        <Text style={appStyles.body}>{testResultLabel('Speech', result.speech.severity, 'Possible slurring')}</Text>
      </View>

      {(result.face.severity !== 'green' || result.arm.severity !== 'green' || result.speech.severity !== 'green') && (
        <View style={appStyles.card}>
          <Text style={appStyles.body}>{EmergencyReminder}</Text>
        </View>
      )}

      <TouchableOpacity style={[appStyles.button, { backgroundColor: '#B91C1C' }]} onPress={callEmergency}>
        <Text style={appStyles.buttonText}>Call 911</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={share}>
        <Text style={appStyles.buttonText}>Share Results</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={onSave}>
        <Text style={appStyles.buttonText}>Save to History</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={onRetake}>
        <Text style={appStyles.buttonText}>Take Test Again</Text>
      </TouchableOpacity>
    </BaseScreen>
  );
}
