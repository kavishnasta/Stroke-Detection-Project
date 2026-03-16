import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Prompts } from '../constants/messages';
import { Severity } from '../types/landmarks';
import { BaseScreen } from '../ui/BaseScreen';
import { appStyles } from '../ui/theme';

type Props = {
  onComplete: (severity: Severity, flagged: boolean) => void;
};

export function ArmTestScreen({ onComplete }: Props) {
  const [severity, setSeverity] = useState<Severity>('green');

  return (
    <BaseScreen title="Step 2 of 3: Arm Check">
      <View style={appStyles.card}>
        <Text style={appStyles.body}>{Prompts.armPrompt}</Text>
      </View>
      <View style={appStyles.card}>
        <Text style={appStyles.body}>Use accelerometer or MediaPipe Pose wrists (15 and 16) to measure 10s downward drift.</Text>
      </View>

      <TouchableOpacity style={appStyles.button} onPress={() => setSeverity('green')}>
        <Text style={appStyles.buttonText}>Mark Simulated GREEN</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={() => setSeverity('yellow')}>
        <Text style={appStyles.buttonText}>Mark Simulated YELLOW</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={() => setSeverity('red')}>
        <Text style={appStyles.buttonText}>Mark Simulated RED</Text>
      </TouchableOpacity>
      <TouchableOpacity style={appStyles.button} onPress={() => onComplete(severity, severity !== 'green')}>
        <Text style={appStyles.buttonText}>✓ Arm check complete</Text>
      </TouchableOpacity>
    </BaseScreen>
  );
}
