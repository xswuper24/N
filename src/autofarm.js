/*!
 * Tribal Wars 2 Auto Farm v@@version
 * @@repository
 *
 * Copyright Rafael Mafra
 * MIT License
 *
 * @@date
 */

$rootScope = angular.element(document).scope()
modelDataService = injector.get('modelDataService')
socketService = injector.get('socketService')
routeProvider = injector.get('routeProvider')
eventTypeProvider = injector.get('eventTypeProvider')
armyService = injector.get('armyService')
math = require('helper/math')
pid = modelDataService.getSelectedCharacter().getId()

__debug = true

/**
 * @class
 * @param {Object} [settings] - Configurações básicas.
 * @param {Number} settings.maxDistance - Distáncia máxima que os alvos
 *     podem estar.
 * @param {Number} settings.minDistance - Distáncia mínima que os alvos
 *     podem estar.
 * @param {Number} settings.randomBase - Intervalo que será  entre
 *     alterado entre cada ataque com base nesse valor (segundos).
 * @param {String} settings.presetName - Nome do preset usado para os comandos.
 * @param {String} settings.groupIgnore - Nome do grupo usado nas aldeias a
 *     serem ignoradas.
 * @param {Boolean} settings.currentOnly - Apenas a aldeia selecionada será
 *     usada para enviar comandos.
 * @param {Number} settings.eventsLimit - Limite de registros na aba Eventos.
 * @param {String} settings.groupInclude - Nome do grupo que permite alvos
 *     que não sejam abandonadas sejam atacados.
 */
function AutoFarm (settings = {}) {
    /**
     * Versão do script.
     * @type {String}
     */
    this.version = '@@version'

    /**
     * Objeto com todas as configurações padrões.
     * @type {Object}
     */
    this.defaults = {
        maxDistance: '10',
        minDistance: '0',
        maxTravelTime: '01:00:00',
        randomBase: '3',
        presetName: '',
        groupIgnore: '',
        groupInclude: '',
        currentOnly: false,
        eventsLimit: '20',
        language: ''
    }

    /**
     * Objeto com todas as configurações.
     * @type {Object}
     */
    this.settings = angular.merge({}, this.defaults, settings)

    /**
     * Objeto com todos os dados do jogador.
     * @type {Object}
     */
    this.player = modelDataService.getSelectedCharacter()
    this.player.villages = Object.values(this.player.data.villages)

    /**
     * Identifica o status do script.
     * @type {Boolean}
     */
    this.paused = true

    /**
     * Identifica se o jogador possui apenas uma aldeia.
     * @type {Boolean}
     */
    this.uniqueVillage = this.player.villages.length === 1

    /**
     * Aldeia atualmente seleciona.
     * @type {Object}
     */
    this.selectedVillage = modelDataService.getSelectedVillage()

    /**
     * Lista de todos aldeias alvos possíveis para cada aldeia do jogador.
     * @type {Object}
     */
    this.targetList = {}

    /**
     * Lista com todas aldeias que estão com limite de 50 comandos.
     * Os valores são o tempo em que o comando mais proximo retornará.
     * Nota: tempo em milisegundos.
     * @type {Object}
     */
    this.villagesNextReturn = {}

    /**
     * Armazena o id do comando que está sendo enviado
     * no momento pelo script.
     * @type {Number}
     */
    this.commandProgressId = null
    
    /**
     * Armazena o callback do comando que está sendo enviado
     * no momento pelo script.
     * @type {Function}
     */
    this.commandProgressCallback = null

    /**
     * Callbacks usados pelos eventos que são disparados no
     * decorrer do script.
     * @type {Object}
     */
    this.eventListeners = {}

    /**
     * Propriedade usada para permitir ou não o disparo de eventos
     * @type {Boolean}
     */
    this.eventsEnabled = true

    /**
     * Preset usado como referência para enviar os comandos
     * @type {Array}
     */
    this.presets = []

    /**
     * Objeto do group de referência para ignorar aldeias/alvos.
     * Contém ID e nome do grupo.
     * @type {Object}
     */
    this.groupIgnore = null

    /**
     * Lista de aldeias ignoradas
     * @type {Array}
     */
    this.ignoredVillages = []

    /**
     * Objeto do group de referência para incluir alvos.
     * Contém ID e nome do grupo.
     * @type {Object}
     */
    this.groupInclude = null

    /**
     * Lista de aldeias incluidas
     * @type {Array}
     */
    this.includedVillages = []

    this.updateExceptionGroups()
    this.updateExceptionVillages()
    this.gameListeners()
    this.i18n()
    this.getPresets(false)

    return this
}

/**
 * Inicia os comandos.
 * @return {Boolean}
 */
AutoFarm.prototype.start = function () {
    if (!this.presets.length) {
        this.event('noPreset')

        return false
    }

    this.paused = false
    this.event('start')
    this.commandInit()

    this.keepRunning()

    return true
}

/**
 * Pausa os comandos.
 * @return {Boolean}
 */
AutoFarm.prototype.pause = function () {
    this.paused = true
    this.event('pause')

    clearTimeout(this.timerId)
    clearTimeout(this.keepRunningId)

    return true
}

/**
 * Mantém o script enviando ataques mesmo quando ele para
 * misteriosamente (Problemas de conexão, internos do game..).
 * É executado a cada 5 minutos (caso não tenha um timeout
 * aguardando já).
 */
AutoFarm.prototype.keepRunning = function () {
    __debug && console.log('.keepRunning()')

    clearTimeout(this.keepRunningId)

    this.keepRunningId = setTimeout(() => {
        if (this.timerId) {
            this.keepRunning()
        } else {
            this.commandInit()
        }
    }, 1000 * 60 * 5)
}

/**
 * Atualiza as novas configurações passados pelo usuário e as fazem
 *     ter efeito caso o farm esteja em funcionamento.
 * @param {Object} changes - Novas configurações.
 */
AutoFarm.prototype.updateSettings = function (changes) {
    this.disableEvents()

    let restart = false
    let update = {}

    if (!this.paused) {
        restart = true
        this.pause()
    }

    if (changes.groupIgnore !== this.settings.groupIgnore) {
        update.groupIgnore = true
    }

    if (changes.groupInclude !== this.settings.groupInclude) {
        update.groupInclude = true
        update.targets = true
    }

    if (changes.presetName !== this.settings.presetName) {
        update.preset = true
    }

    if (changes.minDistance !== this.settings.minDistance) {
        update.targets = true
    }

    if (changes.maxDistance !== this.settings.maxDistance) {
        update.targets = true
    }

    for (let key in changes) {
        this.settings[key] = changes[key]
    }

    if (update.groupIgnore || update.groupInclude) {
        this.updateExceptionGroups()
        this.updateExceptionVillages()
    }

    if (update.preset) {
        this.getPresets()
    }

    if (update.targets) {
        this.targetList = {}
    }

    if (restart) {
        this.start()
    }

    this.enableEvents()
}

/**
 * Desativa o disparo de eventos
 */
AutoFarm.prototype.disableEvents = function () {
    this.eventsEnabled = false
}

/**
 * Ativa o disparo de eventos
 */
AutoFarm.prototype.enableEvents = function () {
    this.eventsEnabled = true
}

/**
 * Seleciona o próximo alvo da aldeia.
 * @param {Boolean} _initial - Parametro interno usado na primeira execução
 *     e do script e após cada alteração entre as aldeias do jogador.
 * @param {Number} _noTargets - Parametro interno para identificar aldeias
 *     que não possuem nenhum alvo.
 * @return {Boolean}
 */
AutoFarm.prototype.nextTarget = function (_initial, _noTargets = 0) {
    __debug && console.log('.nextTarget()')

    let sid = this.selectedVillage.getId()
    let targets = this.targetList[sid]

    if (!_initial) {
        targets.index++
    }

    let i = targets.index

    if (typeof targets[i] !== 'undefined') {
        this.selectedTarget = targets[i]
    } else {
        this.selectedTarget = targets[0]
        targets.index = 0
    }

    let target = this.selectedTarget

    if (this.ignoredVillages.includes(target.id)) {
        if (_noTargets === targets.length) {
            return this.event('noTargets')
        }

        this.event('ignoredTarget', [target])

        return this.nextTarget(false, ++_noTargets)
    }

    if (!_initial) {
        this.event('nextTarget', [this.selectedTarget])
    }

    return true
}

/**
 * Apenas um atalho para facilitar a leitura
 */
AutoFarm.prototype.selectFirstTarget = function () {
    __debug && console.log('.selectFirstTarget()')

    return this.nextTarget(true)
}

/**
 * Obtem a lista de alvos para a aldeia selecionada.
 * @param {Function} callback
 * @return {Boolean}
 */
AutoFarm.prototype.getTargets = function (callback) {
    __debug && console.log('.getTargets()')

    let coords = this.selectedVillage.getPosition()
    let sid = this.selectedVillage.getId()

    if (sid in this.targetList) {
        return callback()
    }

    let size = this.settings.maxDistance

    socketService.emit(routeProvider.MAP_GETVILLAGES, {
        x: coords.x - size,
        y: coords.y - size,
        width: size * 2,
        height: size * 2
    }, (data) => {
        let villages = data.villages
        let nearby = []
        let i = villages.length

        while (i--) {
            let target = villages[i]

            if (target.id === sid) {
                continue
            }

            // Se a aldeia estiver na lista do grupo de incluidas
            // a verificação se a aldeia é abandonada não é utilizada.
            if (!this.includedVillages.includes(target.id)) {
                if (target.character_id) {
                    continue
                }
            }

            let distance = math.actualDistance(coords, target)

            if (distance < this.settings.minDistance) {
                continue
            }

            if (distance > this.settings.maxDistance) {
                continue
            }

            nearby.push({
                coords: [target.x, target.y],
                distance: distance,
                id: target.id,
                name: target.name
            })
        }

        if (nearby.length === 0) {
            if (this.nextVillage()) {
                this.getTargets(callback)
            } else {
                this.event('noTargets')
            }

            return false
        }

        this.targetList[sid] = nearby.sort((a, b) => a.distance - b.distance)
        this.targetList[sid].index = 0
        this.selectedTarget = this.targetList[sid][0]

        callback()
    })

    return false
}

/**
 * Seleciona a próxima aldeia do jogador.
 * @param {Number} _loop - Parametro interno usado para identificar quando
 *     todas aldeias do jogador foram ignoradas.
 * @return {Boolean}
 */
AutoFarm.prototype.nextVillage = function (_loop = 0) {
    __debug && console.log('.nextVillage()')

    if (this.uniqueVillage || this.settings.currentOnly) {
        return false
    }

    if (_loop === this.player.villages.length) {
        this.event('noVillages')

        return false
    }

    let nextIndex = this.player.villages.indexOf(this.selectedVillage) + 1

    this.selectedVillage =
        typeof this.player.villages[nextIndex] !== 'undefined'
            ? this.player.villages[nextIndex]
            : this.player.villages[0]

    if (this.ignoredVillages.includes(this.selectedVillage.getId())) {
        return this.nextVillage(++_loop)
    }

    if (this.selectedVillage.getId() in this.villagesNextReturn) {
        return this.nextVillage(++_loop)
    }

    this.event('nextVillage', [this.selectedVillage])

    return true
}

/**
 * Seleciona uma aldeia específica do jogador.
 * @param {Number} vid - ID da aldeia à ser selecionada.
 * @return {Boolean}
 */
AutoFarm.prototype.selectVillage = function (vid) {
    __debug && console.log('.selectVillage()')

    let i = this.player.villages.indexOf(vid)

    if (i !== -1) {
        this.selectedVillage = this.player.villages[i]
        this.firstFirstTarget()

        return true
    }

    return false
}

/**
 * Chama os eventos.
 * @param {String} - Nome do evento.
 * @param {Array} data - Lista de dados.
 */
AutoFarm.prototype.event = function (type, data) {
    __debug && console.info('event.' + type)

    if (!this.eventsEnabled) {
        return this
    }

    if (type in this.eventListeners) {
        let listeners = this.eventListeners[type]

        for (let i = 0; i < listeners.length; i++) {
            listeners[i].apply(this, data)
        }
    }

    return this
}

/**
 * Registra um evento.
 * @param {String} type - Nome do evento.
 * @param {Function} handler - Função chamada quando o evento for disparado.
 */
AutoFarm.prototype.on = function (type, handler) {
    if (typeof handler === 'function') {
        if (!(type in this.eventListeners)) {
            this.eventListeners[type] = []
        }

        this.eventListeners[type].push(handler)
    }

    return this
}

/**
 * Obtem o preset que houver tropas sulficientes e que o tempo do
 *     comando não seja maior do que o configurado.
 * @param {Function} villageUnits - Quantidade de unidades disponíveis
 *     na aldeia.
 *
 * @return {Number} Retorna 0 caso o preset não tenha enviado por causa
 *     de limite de tempo de viagem ou 1 se não tiver nenhum preser com
 *     tropas sulficientes.
 */
AutoFarm.prototype.presetAvail = function (villageUnits) {
    __debug && console.log('.presetAvail()')

    let timeLimit = false

    for (let preset of this.presets) {
        let avail = true

        for (let unit in preset.units) {
            if (villageUnits[unit].in_town < preset.units[unit]) {
                avail = false
            }
        }

        if (avail) {
            if (this.presetTimeAvail(preset)) {
                return preset
            } else {
                timeLimit = true

                continue
            }
        }
    }

    return timeLimit ? 0 : 1
}

/**
 * Verifica se o tempo de viagem do preset, da aldeia de origem até
 *     a aldeia alvo não ultrapassa o tempo máximo.
 * @param {Object} preset - Preset usado no calculo.
 */
AutoFarm.prototype.presetTimeAvail = function (preset) {
    __debug && console.log('.presetTimeAvail()')

    let maxTime = AutoFarm.time2seconds(this.settings.maxTravelTime)
    let coords = this.selectedVillage.getPosition()
    let target = {
        x: this.selectedTarget.coords[0],
        y: this.selectedTarget.coords[1]
    }

    let distance = math.actualDistance(coords, target)
    let travelTime = armyService.calculateTravelTime(preset, {
        barbarian: true
    })
    let totalTravelTime = armyService.getTravelTimeForDistance(
        preset,
        travelTime,
        distance,
        'attack'
    )

    return maxTime > totalTravelTime
}

/**
 * Converte uma string com um tempo em segundos.
 * @param {String} time - Tempo que será convertido (hh:mm:ss)
 */
AutoFarm.time2seconds = function (time) {
    time = time.split(':')
    time[0] = parseInt(time[0], 10) * 60 * 60
    time[1] = parseInt(time[1], 10) * 60
    time[2] = parseInt(time[2], 10)

    return time.reduce((a, b) => {
        return a + b
    })  
}

/**
 * Carrega todos os comandos de uma aldeia.
 * @param {Function} callback
 */
AutoFarm.prototype.getVillageCommands = function (callback) {
    __debug && console.log('.getVillageCommands()')

    socketService.emit(routeProvider.GET_OWN_COMMANDS, {
        village_id: this.selectedVillage.getId()
    }, (data, event) => {
        // Internal fucked up code, INNOGAMES?
        if (event === 'Exception/DbException') {
            this.getVillageCommands(callback)

            return false
        }

        callback(data.commands)
    })
}

/**
 * Carrega as unidades de uma aldeia.
 * @param {Function} callback
 */
AutoFarm.prototype.getVillageUnits = function (callback) {
    __debug && console.log('.getVillageUnits()')

    socketService.emit(routeProvider.VILLAGE_UNIT_INFO, {
        village_id: this.selectedVillage.getId()
    }, (data) => {
        callback(data.available_units)
    })
}

/**
 * Obtem preset apropriado para o script
 * @param {Function} callback
 * @param {Object} presets - Parametro interno usado para evitar
 *     repetição de código.
 */
AutoFarm.prototype.getPresets = function (callback, presets) {
    __debug && console.log('.getPresets()')

    if (presets) {
        this.presets = []

        for (let id in presets) {
            if (presets[id].name === this.settings.presetName) {
                presets[id].units =
                    AutoFarm.cleanPresetUnits(presets[id].units)

                this.presets.push(presets[id])
            }
        }

        if (callback) {
            callback()
        }

        return true
    }

    if (modelDataService.getPresetList().isLoaded()) {
        return this.getPresets(callback,
            modelDataService.getPresetList().presets)
    }

    socketService.emit(routeProvider.GET_PRESETS, {}, (data) => {
        this.getPresets(callback, data.presets)
    })
}

/**
 * Remove todas propriedades que tiverem valor zero.
 * @param {Object} units - Unidades do preset a serem filtradas.
 * @return {Object}
 */
AutoFarm.cleanPresetUnits = function (units) {
    let pure = {}

    for (let unit in units) {
        if (units[unit] > 0) {
            pure[unit] = units[unit]
        }
    }

    return pure
}

/**
 * Atualiza o grupo de referência para ignorar aldeias e incluir alvos
 */
AutoFarm.prototype.updateExceptionGroups = function () {
    __debug && console.log('.updateExceptionGroups()')

    let ignoreUpdated = false
    let includeUpdated = false

    let groups = modelDataService.getGroupList().getGroups()

    for (let id in groups) {
        if (!ignoreUpdated) {
            if (groups[id].name === this.settings.groupIgnore) {
                this.groupIgnore = {
                    id: id,
                    name: groups[id].name
                }

                ignoreUpdated = true
            }
        }

        if (!includeUpdated) {
            if (groups[id].name === this.settings.groupInclude) {
                this.groupInclude = {
                    id: id,
                    name: groups[id].name
                }

                includeUpdated = true
            }
        }
    }

    if (!ignoreUpdated) {
        this.groupIgnore = null
    }

    if (!includeUpdated) {
        this.groupInclude = null
    }
}

/**
 * Atualiza a lista de aldeias ignoradas e incluidas
 */
AutoFarm.prototype.updateExceptionVillages = function () {
    __debug && console.log('.updateExceptionVillages()')

    let groupList = modelDataService.getGroupList()

    if (this.groupIgnore) {
        this.ignoredVillages =
            groupList.getGroupVillageIds(this.groupIgnore.id)   
    } else {
        this.ignoredVillages = []
    }

    if (this.groupInclude) {
        this.includedVillages =
            groupList.getGroupVillageIds(this.groupInclude.id)
    } else {
        this.includedVillages = []
    }
}

/**
 * Detecta todas atualizações de dados do jogo que são importantes
 * para o funcionamento do AutoFarm.
 */
AutoFarm.prototype.gameListeners = function () {
    __debug && console.log('.gameListeners()')

    let updatePresets = () => {
        this.getPresets(false)

        this.event('presetsChange')

        if (!this.presets.length) {
            this.event('noPreset')
            
            if (!this.paused) {
                this.pause()
            }
        }
    }

    let updateGroups = ($event, data) => {
        this.updateExceptionGroups()
        this.updateExceptionVillages()

        this.event('groupsChanged')
    }

    let continueCommand = ($event, data) => {
        if (this.commandProgressId === data.target.id) {
            this.commandProgressCallback(data)
            this.commandProgressCallback = null
            this.commandProgressId = null
        }
    }

    // Detecta todos comandos enviados no jogo (não apenas pelo script)
    // e identifica os que foram enviados pelo script.
    // Por que isso?
    // A livraria do jogo não retorna um callback na mesma função
    // quando um comano é enviado, então é preciso ler todos e identificar
    // o que foi enviado pelo script.
    $rootScope.$on(eventTypeProvider.COMMAND_SENT, continueCommand)

    // Detecta alterações nas prédefinições
    $rootScope.$on(eventTypeProvider.ARMY_PRESET_UPDATE, updatePresets)
    $rootScope.$on(eventTypeProvider.ARMY_PRESET_DELETED, updatePresets)

    // Detecta alterações nos grupos de aldeias
    $rootScope.$on(eventTypeProvider.GROUPS_UPDATED, updateGroups)
    $rootScope.$on(eventTypeProvider.GROUPS_CREATED, updateGroups)
    $rootScope.$on(eventTypeProvider.GROUPS_DESTROYED, updateGroups)
}

/**
 * Inicia o ciclo de comandos do script
 */
AutoFarm.prototype.commandInit = function () {
    if (__debug) {
        console.groupEnd('AutoFarm.command')
        console.group('AutoFarm.command')
        console.log('.commandInit()')
    }

    if (this.paused) {
        return false
    }

    let sid = this.selectedVillage.getId()

    // Se aldeia ainda não tiver obtido a lista de alvos, obtem
    // os alvos e executa o comando novamente para dar continuidade.
    let targetsLoaded = this.targetList.hasOwnProperty(sid)

    if (!targetsLoaded) {
        this.getTargets(() => {
            let hasTargets = this.selectFirstTarget()

            if (!hasTargets) {
                this.nextVillage()
            }

            this.commandInit()
        })

        return false
    }

    this.selectFirstTarget()
    
    // Verifica se a aldeia esta na lista de espera por limite de 50 comandos
    // ou não ter unidades sulficientes.
    let isWaiting = this.villagesNextReturn.hasOwnProperty(sid)

    if (isWaiting) {
        let hasVillages = this.nextVillage()

        if (hasVillages) {
            this.commandInit()
        } else {
            this.commandNextReturn()
        }

        return false
    }

    // Caso a aldeia selecionada seja adicionada na lista
    // de aldeias ignoradas no meio da execução.
    if (this.ignoredVillages.includes(sid)) {
        let hasVillages = this.nextVillage()

        if (hasVillages) {
            this.commandInit()
        }

        return false
    }

    this.getVillageCommands((commands) => {
        // Quando o limite de comandos for atingido, a aldeia será colocada
        // na lista de de espera (villagesNextReturn)
        if (commands.length === 50) {
            this.event('commandLimit', [this.selectedVillage])
            this.getNextReturn(commands)

            // Se o jogador tiver apenas uma aldeia, o script
            // aguardará o retorno do comando mais próximo e
            // reinicia a função.
            if (this.uniqueVillage || this.settings.currentOnly) {
                let backTime = this.villagesNextReturn[sid]
                let randomTime = AutoFarm.randomSeconds(5) * 1000

                this.timerId = setTimeout(() => {
                    this.timerId = false

                    this.commandInit()
                }, backTime + randomTime)
            } else {
                this.commandInit()
            }

            return false
        }

        this.getVillageUnits((villageUnits) => {
            let preset = this.presetAvail(villageUnits)

            // Limite de tempo. Apenas troca o alvo e continua.
            if (preset === 0) {
                this.nextTarget()
                this.commandInit()

                return false
            }

            // Nenhum preset esta presente na aldeia. Troca de aldeia.
            if (preset === 1) {
                this.event('noUnits', [this.selectedVillage])
                this.getNextReturn(commands)
                this.commandVillageNoUnits(commands)

                return false
            }

            this.sendCommand(preset, () => {
                this.event('sendCommand', [
                    this.selectedVillage,
                    this.selectedTarget
                ])
                
                this.nextTarget()

                let interval

                interval = AutoFarm.randomSeconds(this.settings.randomBase)
                interval *= 1000

                this.timerId = setTimeout(() => {
                    this.timerId = false

                    this.commandInit()
                }, interval)

                this.event('nextCommandIn', [interval])
            })
        })
    })
}

/**
 * Calcula o tempo de retorno (em milisegundos) do comando
 * mais proximo de voltar à aldeia.
 * @param {Object} commands - Lista de comandos da aldeia.
 * @return {Boolean}
 */
AutoFarm.prototype.getNextReturn = function (commands) {
    __debug && console.log('.getNextReturn()')

    let vid = this.selectedVillage.getId()
    let backIn = this.getNeabyCommand(commands)

    this.villagesNextReturn[vid] = backIn

    setTimeout(() => {
        delete this.villagesNextReturn[vid]

        this.event('commandReturn', [vid])
    }, backIn)

    return true
}

/**
 * Lida com aldeias que não possuem mais a quantidade
 * mínima para continuar enviando comandos.
 * @param {Object} commands - Lista de comandos da aldeia.
 * @return {Boolean}
 */
AutoFarm.prototype.commandVillageNoUnits = function (commands) {
    __debug && console.log('.commandVillageNoUnits()')

    if (this.uniqueVillage || this.settings.currentOnly) {
        if (!commands.length) {
            return this.event('noUnitsNoCommands')
        }

        let backTime = this.getNeabyCommand(commands)

        this.timerId = setTimeout(() => {
            this.timerId = false

            this.commandInit()
        }, backTime)
    } else {
        if(!this.nextVillage()) {
            return this.commandNextReturn()
        }

        this.commandInit()
    }
}

/**
 * Envia um comando
 * @param {Object} preset - Preset a ser enviado.
 * @param {function} callback
 * @return {Boolean}
 */
AutoFarm.prototype.sendCommand = function (preset, callback) {
    __debug && console.log('.sendCommand()')

    this.simulate(() => {
        // Algumas vezes o script é parado depois de .commandInit ter
        // iniciado, então uma verificação no final da função pode parar
        // um ataque indesejado.
        if (this.paused) {
            return false
        }

        socketService.emit(routeProvider.SEND_CUSTOM_ARMY, {
            start_village: this.selectedVillage.getId(),
            target_village: this.selectedTarget.id,
            type: 'attack',
            units: preset.units,
            catapult_target: 'headquarter',
            officers: {},
            icon: 0
        })

        this.commandProgressId = this.selectedTarget.id
        this.commandProgressCallback = callback  
    })

    return true
}

/**
 * Recomeça os comandos quando o próximo comando returnar
 */
AutoFarm.prototype.commandNextReturn = function () {
    __debug && console.log('.commandNextReturn()')

    let next = this.nextVillageUnits()

    this.timerId = setTimeout(() => {
        this.timerId = false
        
        this.selectVillage(next.vid)
        this.commandInit()
    }, next.time)

    return true
}

/**
 * Obtem a aldeia dentre todas aldeias que houver o comando
 * com o menor tempo de retorno.
 * @return {Object}
 */
AutoFarm.prototype.nextVillageUnits = function () {
    __debug && console.log('.nextVillageUnits()')

    let villages = []

    for (let vid in this.villagesNextReturn) {
        villages.push({
            vid: vid,
            time: this.villagesNextReturn[vid]
        })
    }

    villages.sort((a, b) => a.time - b.time)

    return villages[0]
}

/**
 * Obtem o tempo do comando com o menor tempo de retorno dentre
 * todos os comandos.
 * @param {Object} commands - Lista de comandos da aldeia.
 * @return {Number}
 */
AutoFarm.prototype.getNeabyCommand = function (commands) {
    __debug && console.log('.getNeabyCommand()')

    let now = new Date().getTime() / 1000
    let timers = []

    for (let i = 0; i < commands.length; i++) {
        let cmd = commands[i]

        if (cmd.type === 'support' && cmd.direction === 'forward') {
            continue
        }

        let time = cmd.time_completed - cmd.time_start
        let remain = cmd.time_completed - now

        if (cmd.direction === 'forward') {
            remain += time
        }

        timers.push(remain)
    }

    timers.sort((a, b) => a - b)

    return Math.round((timers[0] * 1000) + 5000)
}

/**
 * Gera um número aleatório aproximado da base.
 * @param {Number} base - Número base para o calculo.
 * @param {Number} [_range] - Range maxímo e minimo de aleatoriedade.
 */
AutoFarm.randomSeconds = function (base, _range) {
    base = parseInt(base, 10)
    
    let max
    let min

    if (_range) {
        max = base + _range
        min = base - _range
    } else {
        max = base + (base / 2)
        min = base - (base / 2)
    }

    return Math.round(Math.random() * (max - min) + min)
}

/**
 * Simula algumas requisições feita pelo jogo quando é enviado
 *     comandos manualmente.
 * @param {Object} callback
 */
AutoFarm.prototype.simulate = function (callback) {
    __debug && console.log('.simulate()')

    let random = AutoFarm.randomSeconds(1)

    let attackingFactor = () => {
        socketService.emit(routeProvider.GET_ATTACKING_FACTOR, {
            target_id: this.selectedTarget.id
        })
    }

    let shopOffers = () => {
        socketService.emit(routeProvider.PREMIUM_LIST_SHOP_OFFERS, {})
    }

    attackingFactor()
    shopOffers()

    setTimeout(() => {
        attackingFactor()
        callback()
    }, random * 1000)
}
