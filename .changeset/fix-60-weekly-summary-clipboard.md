---
"gitview": patch
---

fix(WeeklySummary): fallback de cópia do markdown fora de contexto seguro

O botão "copiar markdown" agora tenta primeiro a Clipboard API e, se ela
não existir (http na LAN) ou rejeitar, copia via textarea temporária com
`document.execCommand('copy')`. Sucesso pelo fallback mostra o mesmo
feedback do caminho normal ("copiado!" + toast de sucesso); só quando
ambos os caminhos falham aparece o toast de erro. O botão fica
desabilitado apenas quando nenhum caminho de cópia existe.
