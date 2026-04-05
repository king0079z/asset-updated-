import { Redirect } from 'expo-router';

/** Native handheld screen retired — all roles use the WebView taskpane. */
export default function InventoryScreen() {
  return <Redirect href="/(tabs)/" />;
}
