# Starlink — Placas dinâmicas com QR Code e NFC

Plataforma web para administrar placas físicas com QR Code e NFC. Cada placa recebe **um link público** no formato `/r/<código>`, o mesmo no QR Code e na tag NFC. O destino é resolvido pelo servidor a cada acesso e pode ser alterado a qualquer momento, sem reimprimir o QR nem regravar a tag.

> Uma tag NFC passiva não pode ser regravada remotamente. Por isso a tag guarda só o link fixo (`/r/<código>`) e a troca de destino acontece no servidor.

## Funcionalidades

- **Administrador único:** senha com hash Argon2id, sessão em cookie `HttpOnly`/`SameSite=Strict` (`Secure` e prefixo `__Host-` em produção), expiração por inatividade e por tempo absoluto, e logout.
- **Clientes:** criar, listar, buscar, editar, arquivar e reativar. **Anonimização (LGPD)** de clientes arquivados.
- **Placas:** cada placa recebe um número sequencial na criação (1, 2, 3…), que vira o código do link (`/r/1`). O código pode ser alterado depois (ex.: `/r/loja-centro`); **o código anterior continua redirecionando para a mesma placa** e nunca é usado por outra. Tipos `QR`, `NFC` e `QR_NFC`. Arquivamento sem perda de histórico.
- **Importação CSV:** prévia com erros por linha. Grava tudo ou nada: só importa quando todas as linhas são válidas. Limites de 512 KB e 1000 linhas.
- **Link:** um destino por placa (o mesmo para QR e NFC), ativação/desativação e redirecionamento `302` com `Cache-Control: no-store`, para não deixar o navegador guardar o destino.
- **Página de múltiplos links:** botões configuráveis (ex.: Instagram, Google Avaliações, WhatsApp). O conteúdo é exibido como texto; HTML não é interpretado.
- **Agendamentos:** troca de destino com data, hora e fuso. O destino é calculado no momento do acesso, então continua correto depois de reinícios do servidor.
- **Histórico auditável:** registra quando o destino ou o código mudou, com o valor anterior e o novo.
- **Painel:** totais e acessos por período, cliente e placa, com gráfico e tabela.
- **QR Code:** exportação em SVG e PNG (correção de erro nível Q).
- **NFC:** instruções de gravação NDEF.
- **Operação:** backups criptografados, restauração testável, verificação de integridade, health check, Docker Compose e HTTPS automático com Caddy.

## Stack

Next.js 16 (App Router, Route Handlers), React 19, TypeScript estrito, Tailwind CSS 4, shadcn/ui (tema Caffeine, claro/escuro), zod, @node-rs/argon2, Vitest.

**Persistência:** somente arquivos locais criptografados. Não há banco de dados.

## Começando

Requisitos: Node.js ≥ 22.18 (recomendado 24).

```sh
npm install
cp .env.example .env
npm run admin:bootstrap -- --env .env   # define a senha do admin e gera os segredos
npm run dev                             # http://localhost:3000
```

O `admin:bootstrap` pede a senha (mínimo de 12 caracteres) sem exibi-la e grava no `.env`:

- `ADMIN_PASSWORD_HASH_B64`: o hash Argon2id em base64, porque o `$` do hash quebraria o carregador do `.env`.
- `SESSION_SECRET`.
- `DATA_ENCRYPTION_KEY`.

Ao rodar de novo (para trocar a senha), ele **mantém as chaves existentes**. **Guarde uma cópia da `DATA_ENCRYPTION_KEY` fora do servidor:** sem ela, nem os dados nem os backups podem ser lidos.

### Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` / `build` / `start` | Desenvolvimento, build de produção e execução |
| `npm run lint` | ESLint |
| `npm run typecheck` | Gera os tipos de rota e roda `tsc --noEmit` |
| `npm test` | Testes unitários e de integração (Vitest) |
| `npm run check` | lint + typecheck + testes + build |
| `npm run admin:bootstrap` | Define a senha do admin e gera os segredos |
| `npm run backup` | Backup criptografado em `./backups` (ou `BACKUP_DIR`) |
| `npm run restore -- <arquivo>` | Restaura um backup (`--dry-run`, `--target <dir>`, `--force`) |
| `npm run storage:verify` | Verifica a integridade de todos os arquivos de dados |

## URLs públicas

| URL | Uso |
|---|---|
| `/r/<código>` | Link da placa: impresso no QR Code **e** gravado na tag NFC (registro NDEF URI) |
| `/p/<código>` | Página de múltiplos links; o acesso chega aqui via `/r` |

**Códigos:** a placa nasce com o próximo número da sequência (números já usados manualmente são pulados). O código aceita letras, números, `-` e `_` (até 32 caracteres; maiúsculas viram minúsculas). Ao trocar, o link antigo continua funcionando.

**Atenção:** como QR e NFC usam o mesmo link, os acessos não são separados por canal. E códigos sequenciais são fáceis de adivinhar (`/r/1`, `/r/2`…): qualquer pessoa pode descobrir os destinos das placas testando números. O rate limit (120 acessos/min por IP) dificulta varreduras, mas não as impede. Não use destinos que devam ser secretos.

## Arquitetura

```text
src/
├── app/                  # Rotas, páginas e Route Handlers (lógica mínima)
│   ├── admin/            # Painel (Server Components + formulários client)
│   ├── api/              # APIs: auth, admin/*, health
│   ├── r/                # Link público das placas (QR e NFC)
│   └── p/                # Página pública de múltiplos links
├── components/           # UI reutilizável (shadcn/ui, painel), sem acesso a arquivos
├── hooks/                # useApi (fetch + CSRF)
├── lib/                  # Tipos/utilitários compartilháveis, sem segredos (validação, URLs, fusos)
├── types/                # Modelos de domínio
├── server/               # Somente servidor ("server-only")
│   ├── services/         # Regras de negócio (clientes, placas, importação, estatísticas, QR)
│   ├── repositories/     # Leitura/gravação criptografada e atômica, índices em memória
│   ├── security/         # Sessões, senha, rate limit, CSRF/origem, envelope AES-GCM
│   ├── redirects/        # Resolução de destino (função pura) e resposta HTTP
│   └── container.ts      # Composição da aplicação (singleton por processo)
└── proxy.ts              # CSP com nonce por requisição e proteção de /admin
scripts/                  # Bootstrap do admin, backup, restauração, verificação
tests/                    # Unitários (lib, server) e integração (fluxos completos, HTTP público)
storage/                  # Dados (ignorado pelo Git, fora de public/)
```

**Dependências:** página/componente → Route Handler → service → repository → arquivo. Os módulos de `src/server` importam `server-only`, então o build falha se algum deles for importado num Client Component.

### Persistência e consistência

- **Um arquivo por registro:** `storage/data/clients/<uuid>.enc` e `storage/data/plates/<uuid>.enc`. Destino, agendamentos, códigos anteriores e histórico ficam dentro do arquivo da placa, então **toda mutação é uma única gravação atômica** e não é preciso journal entre arquivos.
- **Gravação atômica:** arquivo temporário → `fsync` → `rename` → `fsync` do diretório. Temporários deixados por uma queda são removidos ao iniciar.
- **Sem lost updates:** as mutações passam por uma fila (mutex). Cada registro tem `version`; uma edição feita sobre uma versão antiga recebe `409`.
- **Índice de redirecionamento** (código atual e anteriores → placa) em memória. É reconstruído a partir dos arquivos a cada inicialização e atualizado só depois da gravação. O próximo número da sequência também é derivado dos arquivos.
- **Migração automática:** placas do formato antigo (código aleatório e destinos separados de QR/NFC) recebem o próximo número ao iniciar; o código antigo continua funcionando e o destino do QR passa a valer para os dois.
- **Formato criptografado:** `SLK` + versão + nonce aleatório (12 B) + tag GCM (16 B) + ciphertext, com AES-256-GCM. O caminho lógico do registro entra como AAD, então um arquivo copiado sobre outro registro falha na verificação. Arquivos adulterados são isolados e reportados no painel e no `/api/health` (status `degraded`).
- **Estatísticas:** contadores em memória, gravados em lote a cada `STATS_FLUSH_SECONDS` (padrão 60 s) e ao receber SIGTERM/SIGINT, em um arquivo por mês. Não registram IP nem dados do visitante.

### Segurança

- **Autorização:** verificada em **todas** as APIs administrativas (`requireAdminApi`). O `proxy.ts` só redireciona de forma otimista e não substitui essa verificação.
- **CSRF:** cada mutação exige `Origin`/`Sec-Fetch-Site` da própria aplicação **e** o token CSRF da sessão no header `x-csrf-token`.
- **Rate limit:**
  - Login: 5 tentativas por IP a cada 15 min, com bloqueio que dobra a cada reincidência, e um limite global contra ataques distribuídos.
  - URLs públicas: 120 acessos por minuto por IP.
- **Validação:** schemas zod em todas as entradas, com limites de tamanho. Destinos aceitam apenas `http`/`https`, sem credenciais embutidas.
- **Headers:** CSP com nonce e `strict-dynamic`, `frame-ancestors 'none'`, HSTS (em produção), `nosniff`, `Referrer-Policy` e `Permissions-Policy`.
- **Logs:** em JSON, com eventos e campos explícitos. Nunca incluem corpo de requisição, senha, documento ou destino. Erros não expõem stack trace.
- **Path traversal:** nenhum caminho de arquivo vem de entrada livre. Os IDs são validados por regex e a lista de coleções é fixa.

## Produção (VPS com Docker Compose)

```sh
cp .env.example .env
npm run admin:bootstrap -- --env .env    # ou rode o script dentro do container
# edite .env: DOMAIN=placas.suaempresa.com.br e PUBLIC_BASE_URL=https://placas.suaempresa.com.br
docker compose up -d --build
```

- O **Caddy** obtém o certificado HTTPS automaticamente (portas 80 e 443 abertas, DNS apontando para a VPS).
- Os dados ficam no volume `starlink-storage` e os backups em `starlink-backups`.
- O container roda sem root, com `no-new-privileges` e sem capabilities, e tem health check em `/api/health`.

### Backup e restauração

```sh
# backup (agende via cron, ex.: diário)
docker compose exec app node scripts/backup.ts

# copie os backups para fora da VPS (ex.: rclone/S3). A chave NÃO vai junto.
docker compose cp app:/app/backups ./backups-vps

# teste de restauração sem tocar nos dados atuais
docker compose exec app node scripts/restore.ts /app/backups/<arquivo>.slkbak --target /tmp/restore-test

# restauração real (aplicação parada; os dados atuais são movidos para storage/before-restore-<data>)
docker compose stop app
docker compose run --rm app node scripts/restore.ts /app/backups/<arquivo>.slkbak --force
docker compose start app
```

Para usar uma chave diferente nos backups, defina `BACKUP_ENCRYPTION_KEY`. O padrão é usar a `DATA_ENCRYPTION_KEY`.

## Limitações conhecidas

- **Uma instância só:** sessões, rate limit, índice e contadores ficam na memória do processo. Rodar várias réplicas exige coordenação adicional (ex.: armazenamento compartilhado com lock e sessões externas). Por isso o compose fixa `replicas: 1`.
- **Reinício encerra as sessões:** reiniciar o processo exige novo login.
- **Perda possível de contagens:** se o processo for morto sem SIGTERM, podem se perder os acessos do último intervalo de flush (até 60 s por padrão).
- **Carga total na memória:** todos os registros são carregados ao iniciar, o que é adequado para milhares de placas. Volumes muito maiores pedem paginação ou particionamento no disco.
- **Anonimização não alcança backups antigos:** ela não altera backups já feitos, que expiram pela retenção (`BACKUP_KEEP`).
- **Criptografia não basta sozinha:** a proteção também depende da senha forte, do HTTPS, da guarda da chave e de backups fora da VPS.
- **Imagem Docker não testada:** o Dockerfile e o compose não foram validados neste ambiente de desenvolvimento.
