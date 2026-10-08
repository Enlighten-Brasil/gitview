/// <reference types="vite/client" />

// shim p/ tsc --noEmit entender imports de .vue (vite build já resolve sozinho)
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
