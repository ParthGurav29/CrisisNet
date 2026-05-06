/**
 * @format
 */

import 'react-native-get-random-values';
import { Buffer } from '@craftzdog/react-native-buffer';
global.Buffer = Buffer;
import { AppRegistry } from 'react-native';
import App from './src/App';

AppRegistry.registerComponent('CrisisNet', () => App);
