windowDisplayService = injector.get('windowDisplayService')
eventQueue = require('queues/EventQueue')
$filter = injector.get('$filter')

/**
 * @class
 * @param {Object} autofarm - Instância do AutoFarm para integração.
 */
function AutoFarmInterface (autofarm) {
    this.autofarm = autofarm

    this.$wrapper = $('#wrapper')
    this.$window = null
    this.$tabs = null
    this.$button = null
    this.$scrollbar = null
    this.$events = null
    this.$status = null
    this.$selected = null
    this.$last = null
    this.$preset = null
    this.$groupIgnore = null

    this.newSettings = {}
    this.activeTab = 'info'
    this.eventsLimit = 20
    this.eventCount = 1

    this.buildStyle()
    this.buildWindow()
    this.bindTabs()
    this.buildButton()
    this.bindSettings()
    this.bindEvents()

    autofarm.getPresets(() => this.updatePresetList())
    this.updateGroupList()

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
    let closeWindow = () => {
        this.$window.style.visibility = 'hidden'
        this.$wrapper.removeClass('window-open')

        eventQueue.trigger(eventQueue.types.RESIZE, {
            'instant': true,
            'right': true
        })
    }

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

    this.$window.innerHTML = AutoFarmInterface.replace(replaces, '@@window')
    this.$wrapper.append(this.$window)

    $('#autofarm-close').on('click', () => closeWindow())

    $(document).on('keydown', (event) => {
        if (event.keyCode === 27) {
            closeWindow()
        }
    })

    this.$scrollbar = jsScrollbar(this.$window.querySelector('.win-main'))
    this.$events = $('#autofarm-events')
    this.$settings = $('#autofarm-settings')
    this.$status = $('#autofarm-status')
    this.$selected = $('#autofarm-selectedVillage')
    this.$last = $('#autofarm-last')
    this.$start = $('#autofarm-start')
    this.$preset = $('#presetName')
    this.$groupIgnore = $('#groupIgnore')

    let selected = this.autofarm.selectedVillage
    let selectedVillage = AutoFarmInterface.createButtonLink(
        'village',
        `${selected.getName()} (${selected.getX()}|${selected.getY()})`,
        this.autofarm.selectedVillage.getId()
    )

    this.$selected.append(selectedVillage.elem)
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
 * Injeta o botão para abrir a janela.
 */
AutoFarmInterface.prototype.buildButton = function () {
    this.$button = document.createElement('div')
    this.$button.id = 'interface-autofarm'
    this.$button.innerHTML = '@@button'

    $('#toolbar-left').prepend(this.$button)

    $(this.$button).on('click', () => {
        this.$window.style.visibility = 'visible'
        this.$wrapper.addClass('window-open')

        eventQueue.trigger(eventQueue.types.RESIZE, {
            'instant': true,
            'right': true
        })
    })
}

/**
 * Listeners das para alteração das configurações do AutoFarm.
 */
AutoFarmInterface.prototype.bindSettings = function () {
    for (let key in this.autofarm.settings) {
        this.newSettings[key] = this.autofarm.settings[key]

        let $input = this.$window.querySelector(`[name="${key}"]`)

        if (!$input) {
            continue
        }

        switch ($input.type) {
        case 'text':
        case 'number':
        case 'select-one':
            if ($input.type !== 'select-one') {
                $input.value = this.autofarm.settings[key]
            }

            $input.addEventListener('change', () => {
                this.newSettings[key] = /^\d+$/.test($input.value)
                    ? parseInt($input.value, 10)
                    : $input.value
            })
            break
        case 'checkbox':
            let change = this.autofarm.settings[key] ? 'add' : 'remove'

            if (this.autofarm.settings[key]) {
                $input.setAttribute('checked', true)
            }

            $input.parentNode.classList[change](
                'icon-26x26-checkbox-checked'
            )

            $input.addEventListener('click', () => {
                this.newSettings[key] = $input.checked
                change = $input.checked ? 'add' : 'remove'
                $input.parentNode.classList[change](
                    'icon-26x26-checkbox-checked'
                )
            })
            break
        }
    }

    this.$settings.on('submit', (event) => {
        event.preventDefault()
    })

    let pid = modelDataService.getSelectedCharacter().getId()

    $('#autofarm-save').on('click', (event) => {
        if (this.$settings[0].checkValidity()) {
            this.autofarm.updateSettings(this.newSettings)

            let json = JSON.stringify(this.newSettings)
            localStorage.setItem(`${pid}_autofarm`, json)

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
    if (this.eventCount >= this.eventsLimit) {
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

    $tr.className = 'list-item'
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
        `<option value="none">${this.autofarm.lang.general.none}</option>`
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
    let groups = modelDataService.getGroupList().getGroups()

    this.$groupIgnore.html(
        `<option value="none">${this.autofarm.lang.general.none}</option>`
    )

    for (let id in groups) {
        let name = groups[id].name

        let selected = this.autofarm.settings.groupIgnore === name
            ? 'selected'
            : ''

        this.$groupIgnore.append(
            `<option value="${name}" ${selected}>${name}</option>`
        )
    }
}

/**
 * Adiciona eventos na interface com base nos eventos do AutoFarm.
 */
AutoFarmInterface.prototype.bindEvents = function () {
    this.autofarm.on('sendCommand', (from, to) => {
        let fromText = `${from.getName()} (${from.getX()}|${from.getY()})`
        let toText = `${to.name} (${to.coords[0]}|${to.coords[1]})`

        this.addEvent({
            links: [
                { type: 'village', name: fromText, id: from.getId() },
                { type: 'village', name: toText, id: to.id }
            ],
            text: this.autofarm.lang.events.sendCommand,
            icon: 'attack'
        })

        this.$last.html($filter('readableDateFilter')(Date.now()))
        this.$status.html(this.autofarm.lang.events.attacking)
    })

    this.autofarm.on('nextVillage', (next) => {
        let nextText = `${next.getName()} (${next.getX()}|${next.getY()})`

        this.addEvent({
            links: [
                { type: 'village', name: nextText, id: next.getId() }
            ],
            icon: 'village',
            text: this.autofarm.lang.events.nextVillage
        })

        let selectedVillage = AutoFarmInterface.createButtonLink(
            'village',
            nextText,
            next.getId()
        )

        this.$selected.html('')
        this.$selected.append(selectedVillage.elem)
    })

    this.autofarm.on('noPreset', () => {
        this.addEvent({
            icon: 'info',
            text: this.autofarm.lang.events.noPreset
        })

        this.$status.html(this.autofarm.lang.events.paused)
    })

    this.autofarm.on('noUnitsNoCommands', () => {
        this.$status.html(this.autofarm.lang.events.noUnitsNoCommands)
    })

    this.autofarm.on('start', () => {
        this.$status.html(this.autofarm.lang.events.attacking)
    })

    this.autofarm.on('pause', () => {
        this.$status.html(this.autofarm.lang.events.paused)
    })

    this.autofarm.on('noVillages', () => {
        this.$status.html(this.autofarm.lang.events.noVillages)
    })
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
