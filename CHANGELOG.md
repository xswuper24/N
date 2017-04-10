# History

## 1.1.0rc 10/04/2017

- [New] Script verifica a cada minuto se os ataques estão em funcionamento.
- [New] Ataques continuam a partir dos mesmos alvos do último funcionamento do script. Exceto se um tempo de 30 minutos sem execução irá resetar de os índices na próxima execução de qualquer maneira.
- [New] Informações do último ataque agora são mostrados ao passar o mouse no botão de abrir a interface.
- [New] Botão de abrir interface agora fica vermelho quando o farm está ativado.
- [Fix] Aldeias adicionadas na lista de incluidas agora tem efeito imediato (não precisa reiniciar o script).
- [Change] Estilo dos elementos <select> melhorados.

## 1.0.1rc 09/04/2017

- [New] Script agora pode ser executado antes do jogo carregar completamente.
- [Fix] Lista de traduções não aparecia na primeira execução do script.

## 1.0.0rc 08/04/2017

- [New] Opção para alterar linguagem da interface.
- [New] Opção para atacar apenas com aldeias com um grupo específico.
- [Fix] Todos presets eram selecionados quando nenhum estava especificado nas configurações.

## 0.11.0beta 08/04/2017

- [New] Opção para incluir alvos de jogadores a partir de grupos.
- [Fix] Problema com funcionamento continuo arrumado.
- [Change] Melhoras na interface.

## 0.10.3 08/04/2017

- [New] Último ataque agora é salvo localmente, mostrando em futuras execuções do script.
- [Change] Interface aperfeiçoada.
- [Fix] Erro ao selecionar aldeias especificas quando o script é executado com múltiplas aldeias.

## 0.10.2 07/04/2017

- [New] Esquema para manter o script rodando mesmo após ocorrer erros internos no jogo.
- [New] Ataque para abrir janela do script e inicar. (Z & Shift+Z)
- [Fix] Janela do script agora se comporta como as outras janelas do jogo.
- [Fix] Notificações de inicio/pausa não apareciam algumas vezes.
- [Fix] Alguns eventos só faziam sentido para jogadores que possuiam mais de uma aldeia.

## 0.10.1 - 04/04/2017

- [Fix] Base aleatória calculando fora do normal.
- [Fix] Aldeias fora do limite de tempo causavam problemas na continuação dos ataques.

## 0.10.0 - 03/04/2017

- [New] Deixando os ataques automáticos similiares aos ataques manuais.
- [New] Simulando algumas açãos antes de cada ataque para simular uma pessoa enviando os ataques manualmente.
- [New] Configuração de distância mínima (campos) adicionada.
- [Fix] Ataques não param quando uma aldeia é adicionada a lista de ignoradas logo antes de enviar um ataque com ela.
- [Change] Configuração "Intervalo" alterada para "Intervalo aleatório" para evitar detecção de bot através de padrões repetitivos.
- [Change] Agora é possível selecionar a predefinição/grupo a partir de uma lista ao invés de adicionar o nome manualmente.

## 0.9.0 - 01/04/2017

- [New] Algumas informações são mostradas no topo da aba Eventos (Aldeia atual, último ataque, etc...).
- [New] Botões das aldeias nos eventos mostram as coordenadas.

## 0.8.1 - 31/03/2017

- [New] Informações sobre as configurações do script são mostradas na aba "Informações".

## 0.8.0 - 31/03/2017

- [New] Nova configuração, tempo máximo de viagem dos ataques.
