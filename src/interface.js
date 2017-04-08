windowDisplayService = injector.get('windowDisplayService')
windowManagerService = injector.get('windowManagerService')
eventQueue = require('queues/EventQueue')
$filter = injector.get('$filter')
hotkeys = injector.get('hotkeys')

/**
 * @class
 * @param {Object} autofarm - Instância do AutoFarm para integração.
 */
function AutoFarmInterface (autofarm) {
    this.autofarm = autofarm
    this.newSettings = {}
    this.activeTab = 'info'
    this.eventCount = 1

    this.buildStyle()
    this.buildWindow()
    this.bindTabs()
    this.bindSettings()
    this.bindEvents()
    this.updateGroupList()

    autofarm.getPresets(() => {
        this.updatePresetList()
    })

    this.$close.on('click', () => {
        this.closeWindow()
    })

    hotkeys.add('esc', () => {
        this.closeWindow()
    }, ['INPUT', 'SELECT', 'TEXTAREA'])

    $rootScope.$on(eventTypeProvider.WINDOW_CLOSED, () => {
        this.closeWindow()
    })

    $(this.$button).on('click', () => {
        this.openWindow()
    })

    hotkeys.add('z', () => {
        this.openWindow()
    })



    return this
}

/**
 * Injeta o CSS.
 */
AutoFarmInterface.prototype.buildStyle = function () {
    this.$style = document.createElement('style')
    this.$style.type = 'text/css'
    this.$style.id = 'autofarm-style'
    this.$style.innerHTML = '@@style'

    document.querySelector('head').appendChild(this.$style)
}

/**
 * Injeta a estrutura.
 */
AutoFarmInterface.prototype.buildWindow = function () {
    this.$window = document.createElement('section')
    this.$window.id = 'autofarm-window'
    this.$window.className = 'autofarm-window twx-window screen left'

    let replaces = angular.merge(
        {
            title: this.autofarm.lang.title,
            version: this.autofarm.version
        },
        this.autofarm.lang.general,
        this.autofarm.lang.settings,
        this.autofarm.lang.events,
        this.autofarm.lang.info
    )

    this.$wrapper = $('#wrapper')

    this.$window.innerHTML = AutoFarmInterface.replace(replaces, '@@window')
    this.$wrapper.append(this.$window)

    this.$button = document.createElement('div')
    this.$button.id = 'interface-autofarm'
    this.$button.innerHTML = '@@button'

    $('#toolbar-left').prepend(this.$button)

    this.$scrollbar = jsScrollbar(this.$window.querySelector('.win-main'))
    this.$events = $('#autofarm-events')
    this.$settings = $('#autofarm-settings')
    this.$status = $('#autofarm-status')
    this.$selected = $('#autofarm-selectedVillage')
    this.$last = $('#autofarm-last')
    this.$start = $('#autofarm-start')
    this.$close = $('#autofarm-close')
    this.$preset = $('#presetName')
    this.$groupIgnore = $('#groupIgnore')
    this.$groupInclude = $('#groupInclude')
    this.$groupOnly = $('#groupOnly')
    this.$language = $('#autofarm-language')

    this.updateLastAttack()
    this.updateSelectedVillage()
}

AutoFarmInterface.prototype.updateLastAttack = function (lastAttack) {
    if (!lastAttack) {
        lastAttack = localStorage[`${player.getId()}_autofarm_lastAttack`]

        if (!lastAttack) {
            return
        }
    } else {
        localStorage[`${player.getId()}_autofarm_lastAttack`] = lastAttack
    }

    lastAttack = parseInt(lastAttack, 10)

    this.$last.html($filter('readableDateFilter')(lastAttack))
}

AutoFarmInterface.prototype.updateSelectedVillage = function () {
    let selected = this.autofarm.selectedVillage

    if (!selected) {
        this.$selected.html(this.autofarm.lang.general.none)

        return false
    }

    let selectedVillage = AutoFarmInterface.createButtonLink(
        'village',
        `${selected.getName()} (${selected.getX()}|${selected.getY()})`,
        this.autofarm.selectedVillage.getId()
    )

    this.$selected.html('')
    this.$selected.append(selectedVillage.elem)
}

/**
 * Abrir janela.
 */
AutoFarmInterface.prototype.openWindow = function () {
    windowManagerService.closeAll()
    
    this.$window.style.visibility = 'visible'
    this.$wrapper.addClass('window-open')

    eventQueue.trigger(eventQueue.types.RESIZE, {
        'instant': true,
        'right': true
    })
}

/**
 * Fecha janela.
 */
AutoFarmInterface.prototype.closeWindow = function () {
    this.$window.style.visibility = 'hidden'
    this.$wrapper.removeClass('window-open')

    eventQueue.trigger(eventQueue.types.RESIZE, {
        'instant': true,
        'right': true
    })
}

/**
 * Controla o estado das abas.
 */
AutoFarmInterface.prototype.tabsState = function () {
    for (let $tab of this.$tabs) {
        let name = $tab.getAttribute('tab')

        let $content = this.$window.querySelector(`.autofarm-content-${name}`)
        let $inner = $tab.querySelector('.tab-inner > div')
        let $a = $tab.querySelector('a')

        if (this.activeTab === name) {
            $content.style.display = ''
            $tab.classList.add('tab-active')
            $inner.classList.add('box-border-light')
            $a.classList.remove('btn-icon', 'btn-orange')

            this.$scrollbar.content = $content
        } else {
            $content.style.display = 'none'
            $tab.classList.remove('tab-active')
            $inner.classList.remove('box-border-light')
            $a.classList.add('btn-icon', 'btn-orange')
        }

        this.$scrollbar.recalc()
    }
}

/**
 * Listener das abas.
 */
AutoFarmInterface.prototype.bindTabs = function () {
    this.$tabs = this.$window.querySelectorAll('.tab')

    for (let tab of this.$tabs) {
        let name = tab.getAttribute('tab')
        
        tab.addEventListener('click', () => {
            this.activeTab = name
            this.tabsState()
        })
    }

    this.tabsState()
}

/**
 * Loop em todas configurações do AutoFarm
 * @param {Function} callback
 */
AutoFarmInterface.prototype.eachSetting = function (callback) {
    for (let key in this.autofarm.settings) {
        let $input = $(`[name="${key}"]`, this.$window)

        if (!$input.length) {
            continue
        }

        callback($input)
    }
}

/**
 * Listeners das para alteração das configurações do AutoFarm.
 */
AutoFarmInterface.prototype.bindSettings = function () {
    let checkedClass = 'icon-26x26-checkbox-checked'

    // Insere os valores nas entradas
    this.eachSetting(($input) => {
        let type = $input[0].type
        let name = $input[0].name

        if (type === 'select-one') {
            if (name === 'language') {
                $input[0].value = this.autofarm.settings.language
            }

            return
        }

        if (type === 'checkbox') {
            if (this.autofarm.settings[name]) {
                $input[0].checked = true
                $input.parent().addClass(checkedClass)
            }

            $input.on('click', () => {
                $input.parent().toggleClass(checkedClass)
            })

            return
        }

        $input.val(this.autofarm.settings[name])
    })

    // Quarda os valores quando salvos
    this.$settings.on('submit', (event) => {
        event.preventDefault()

        if (this.$settings[0].checkValidity()) {
            let settings = {}

            this.eachSetting(($input) => {
                let name = $input[0].name

                settings[name] = $input.val()
            })

            this.autofarm.updateSettings(settings)

            let jsonSettings = JSON.stringify(settings)
            localStorage[`${player.getId()}_autofarm`] = jsonSettings

            $rootScope.$broadcast(eventTypeProvider.MESSAGE_SUCCESS, {
                message: this.autofarm.lang.settings.saved
            })
        }
    })
}

/**
 * Adiciona um evento na aba "Eventos".
 * @param {Object} options - Opções do evento.
 */
AutoFarmInterface.prototype.addEvent = function (options) {
    if (this.eventCount >= this.autofarm.settings.eventsLimit) {
        this.$events.find('tr:last-child').remove()
    }

    let links = []

    if (options.links) {
        for (let i = 0; i < options.links.length; i++) {
            links.push(AutoFarmInterface.createButtonLink(
                options.links[i].type,
                options.links[i].name
            ))
        }

        options.text = AutoFarmInterface.sprintf(options.text, links)
    }

    let $tr = document.createElement('tr')

    $tr.className = 'reduced'
    $tr.innerHTML = AutoFarmInterface.replace({
        date: $filter('readableDateFilter')(Date.now()),
        icon: options.icon,
        text: options.text
    }, '@@event')

    if (options.links) {
        for (let i = 0; i < links.length; i++) {
            options.links[i].elem = $tr.querySelector('#' + links[i].id)
            options.links[i].elem.addEventListener('click', function () {
                windowDisplayService.openVillageInfo(options.links[i].id)
            })
        }
    }

    this.$events.prepend($tr)
    this.$scrollbar.recalc()
    this.eventCount++
}

/**
 * Atualiza a lista de presets na aba de configurações.
 */
AutoFarmInterface.prototype.updatePresetList = function () {
    let loaded = {}
    let presets = modelDataService.getPresetList().presets

    this.$preset.html(
        `<option value="">${this.autofarm.lang.general.disabled}</option>`
    )

    for (let id in presets) {
        let name = presets[id].name

        if (name in loaded) {
            continue
        }

        let selected = this.autofarm.settings.presetName === name
            ? 'selected'
            : ''

        this.$preset.append(
            `<option value="${name}" ${selected}>${name}</option>`
        )

        loaded[name] = true
    }
}

/**
 * Atualiza a lista de grupos na aba de configurações.
 */
AutoFarmInterface.prototype.updateGroupList = function () {
    let types = ['groupIgnore', 'groupInclude', 'groupOnly']
    let groups = modelDataService.getGroupList().getGroups()

    for (let type of types) {
        let $type = '$' + type

        this[$type].html(
            `<option value="">${this.autofarm.lang.general.disabled}</option>`
        )

        for (let groupId in groups) {
            let name = groups[groupId].name

            let selected = this.autofarm.settings[type] === name
                ? 'selected'
                : ''

            this[$type].append(
                `<option value="${name}" ${selected}>${name}</option>`
            )
        }
    }
}

/**
 * Adiciona eventos na interface com base nos eventos do AutoFarm.
 */
AutoFarmInterface.prototype.bindEvents = function () {
    let events = {
        sendCommand: (from, to) => {
            let fromText = `${from.getName()} (${from.getX()}|${from.getY()})`
            let toText = `${to.name} (${to.coords[0]}|${to.coords[1]})`

            this.addEvent({
                links: [
                    { type: 'village', name: fromText, id: from.getId() },
                    { type: 'village', name: toText, id: to.id }
                ],
                text: this.autofarm.lang.events.sendCommand,
                icon: 'attack-small'
            })

            this.$status.html(this.autofarm.lang.events.attacking)
            this.updateLastAttack(Date.now())
        },
        nextVillage: (next) => {
            let nextText = `${next.getName()} (${next.getX()}|${next.getY()})`

            this.addEvent({
                links: [
                    { type: 'village', name: nextText, id: next.getId() }
                ],
                icon: 'village',
                text: this.autofarm.lang.events.nextVillage
            })

            this.updateSelectedVillage()
        },
        noPreset: () => {
            this.addEvent({
                icon: 'info',
                text: this.autofarm.lang.events.noPreset
            })

            this.$status.html(this.autofarm.lang.events.paused)
            this.autofarm.pause()
        },
        commandLimit: () => {
            if (this.autofarm.uniqueVillage) {
                this.$status.html(this.autofarm.lang.events.commandLimit)
            }
        },
        noUnits: () => {
            if (this.autofarm.uniqueVillage) {
                this.$status.html(this.autofarm.lang.events.noUnits)
            }
        },
        noUnitsNoCommands: () => {
            this.$status.html(this.autofarm.lang.events.noUnitsNoCommands)
        },
        start: () => {
            this.$status.html(this.autofarm.lang.events.attacking)
        },
        pause: () => {
            this.$status.html(this.autofarm.lang.events.paused)
        },
        noVillages: () => {
            this.$status.html(this.autofarm.lang.events.noVillages)
        },
        playerVillagesUpdate: () => {
            this.updateSelectedVillage()
        }
    }

    for (let type in events) {
        this.autofarm.on(type, events[type])
    }
}

/**
 * Cria um botão com um icone e link (player, village, ...).
 * @param {String} icon - Icone do botão.
 * @param {String} text - Texto dentro do botão.
 * @param {Number} vid - ID da aldeia
 */
AutoFarmInterface.createButtonLink = function (icon, text, vid) {
    let id = Math.round(Math.random() * 1e5)
    let template = '<a id="l{{ id }}" class="img-link icon-20x20-' + 
        '{{ icon }} btn btn-orange padded">{{ text }}</a>'

    let html = AutoFarmInterface.replace({
        icon: icon,
        text: text,
        id: id
    }, template)

    let elem = document.createElement('div')
    elem.innerHTML = html
    elem = elem.firstChild

    elem.addEventListener('click', function () {
        windowDisplayService.openVillageInfo(vid)
    })

    return {
        html: html,
        id: 'l' + id,
        elem: elem
    }
}

/**
 * Substitui {{ valores }} em um string.
 * @param {Object} values - itens a serem substituidos e valores.
 * @param {String} template - String a ser alterada.
 */
AutoFarmInterface.replace = function (values, template) {
    let rkey = /\{\{ ([a-zA-Z0-9\-\_]+) \}\}/g

    template = template.replace(rkey, function (match, key) {
        return values[key]
    })

    return template
}

/**
 * Dispensa apresentações
 */
AutoFarmInterface.sprintf = function (format, replaces) {
    return format.replace(/{(\d+)}/g, function (match, number) {
        return typeof replaces[number].html !== 'undefined'
            ? replaces[number].html
            : match
    })
}
