---
layout: home
title: gitview
hero:
  name: gitview
  text: Dashboard de métricas de git & GitHub
  tagline: Dashboard open-source que transforma o histórico do git e a atividade do GitHub em métricas acionáveis para o time.
  image:
    src: /logo.svg
    alt: Logo do gitview
  actions:
    - theme: brand
      text: Começar
      link: /pt-BR/guide/introduction
    - theme: alt
      text: Ver no GitHub
      link: https://github.com/Enlighten-Brasil/gitview
features:
  - icon: 📊
    title: Métricas que importam
    details: Commits, pull requests, reviews e releases por pessoa, time e repositório — tudo em um só lugar.
  - icon: 🔌
    title: Integração com GitHub
    details: Coletores incrementais puxam a atividade via API do GitHub com um personal access token.
  - icon: 🎛️
    title: Filtros e drill-down
    details: Recorte cada gráfico por período, repositório ou pessoa do time para responder perguntas reais.
  - icon: 👥
    title: Ciente do time
    details: Mapeie pessoas em times e aliases para que as métricas reflitam como a org realmente trabalha.
  - icon: 📦
    title: Publicação estática
    details: Os dados vivem em arquivos JSON — publique o dashboard no GitHub Pages ou em qualquer host estático.
  - icon: 🔒
    title: Local-first
    details: Tudo roda na sua máquina ou no CI; seus dados nunca saem do seu ambiente.
---

## Como funciona

1. **Colete** — os coletores puxam o histórico do git e a atividade do GitHub para arquivos JSON locais.
2. **Build** — o app Vite renderiza o dashboard a partir dos dados coletados, sem backend.
3. **Publique** — faça deploy da saída estática no GitHub Pages (como a [demo pública](https://enlighten-brasil.github.io/gitview/)) ou em qualquer host estático.
