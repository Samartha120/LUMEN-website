import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { C } from "../../theme";
import { styles } from "./Field.styles";
import type { FieldProps } from "./Field.types";

/**
 * A labelled text input that owns its own focus state.
 *
 * Every screen was tracking `focused` by hand, which is four lines of state
 * per field and one more thing to get wrong when a form grows.
 */
export function Field({ label, error, hint, multiline, style, onFocus, onBlur, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        {...rest}
        multiline={multiline}
        placeholderTextColor={C.muted}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[
          styles.input,
          multiline && styles.multiline,
          focused && styles.focused,
          error ? styles.errored : null,
        ]}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}
