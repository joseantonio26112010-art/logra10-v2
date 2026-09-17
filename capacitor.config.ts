import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.logra10.app',
  appName: 'Logra10',
  webDir: '.output/public',
  server: {
    "androidScheme": "https",
    "allowNavigation": ["*"],
    "cleartext": true
},
"plugins": {
   "ScreenOrientation": {
     "orientation": "landscape"
    }
 }
};

export default config;
