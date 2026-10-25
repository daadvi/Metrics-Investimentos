# Relatório técnico de qualidade — Metrics Investimentos v1.4 RC1

## Evidências verificadas

- `npm test`: **168 testes aprovados**, zero falhas, Node.js v22, ambiente Linux de desenvolvimento.
- Testes de API autenticada e de ponta a ponta em Node.js com banco de dados temporário; testes de importação IPE CSV/ZIP sintético, separação entre carteiras, auditoria fiscal, exportação Excel e adaptadores de fornecedores usando respostas artificiais e URLs fixas.
- Extração DFP CSV representativo preserva valores brutos, escala e natureza da demonstração (2 testes novos); não aplica cálculos de valuation com unidades incertas.
- Exemplo de resposta das APIs Alpha Vantage, HG Brasil, Dados de Mercado e Massive processado por normalizadores isolados. Proventos provenientes de fornecedores não recebem selo oficial e não criam créditos/ordens.
- Chaves externas não são persistidas pelo adaptador BYOK no banco do Metrics.
- `node --check` da interface e dos módulos principais executado sem erros.

## Validações pendentes

- **Executável Windows:** o `.exe` v1.4 ainda deve ser compilado pelo GitHub Actions, aberto e avaliado com hardware real.
- **Fornecedores:** nenhuma chave pessoal válida foi utilizada para testar uma requisição HTTP real a um plano contratado. Respostas e autorização podem variar. Política de licença/redistribuição requer revisão contratual antes de comercialização.
- **CVM:** não foi possível comprovar download online real de IPE/DFP pelo ambiente. O índice IPE não identifica automaticamente datas-com nem valores de proventos; a DFP não fornece cotações.
- **IA:** conectores com Ollama/OpenAI e schemas de ferramentas preparados; não validado processamento real com modelo instalado ou chave autenticada nesta execução. Não há treinamento de pesos nem fine-tuning de provedor externo.
- **Fiscal:** o módulo identifica documentos faltantes e produz resultados auxiliares, mas **não calcula imposto devido integral, não emite DARF e não certifica a declaração**. Faltam regras completas por exercício, day trade/IRRF, derivativos, exterior, compensações e auditoria contábil independente.
- **Importação B3 PDF:** suporte existente a PDFs com texto, mas não OCR universal nem validação do PDF específico do usuário.
- **Frontend:** navegador automatizado do ambiente rejeitou conexões localhost (ERR_BLOCKED_BY_ADMINISTRATOR); nenhuma afirmação de verificação visual real do frontend v1.4.
- **Segurança:** sem auditoria independente do Electron, armazenamento e supply chain; proteção do banco deve ser testada com safeStorage no Windows real. Backups não substituem conciliação financeira.

## Tratamento de riscos

- Endpoint com host HTTPS allowlist, URL construída pela aplicação, limite de payload e redirecionamento negado, token não armazenado, isolamento por carteira.
- Dados de mercado datados, defasados quando aplicável; USD isolado de BRL.
- Valores não verificados permanecem com status de fornecedor; dados oficialmente publicados mas enviados por arquivo local preservam origem **declarada**, não autenticidade comprovada.
- Fiscal nunca retorna imposto devido ou DARF inventado.

**Classificação atual:** BETA/Release Candidate, **não software financeiro certificado para investidores profissionais**. Não reivindicar equivalência total ao Investidor10.
