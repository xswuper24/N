if (typeof loadingAutofarm === 'undefined') {
    loadingAutofarm = true

    let init = function () {
        player = modelDataService.getSelectedCharacter()

        let settings

        settings = localStorage.getItem(`${player.getId()}_autofarm`)
        settings = settings ? JSON.parse(settings) : {}

        af = new AutoFarm(settings)
        ui = new AutoFarmInterface(af)

        af.on('start', function () {
            ui.$start.html(af.lang.general.pause)
            ui.$start.removeClass('btn-green')
            ui.$start.addClass('btn-red')

            $rootScope.$broadcast(eventTypeProvider.MESSAGE_SUCCESS, {
                message: af.lang.general.started
            })
        })

        af.on('pause', function () {
            ui.$start.html(af.lang.general.start)
            ui.$start.removeClass('btn-red')
            ui.$start.addClass('btn-green')

            $rootScope.$broadcast(eventTypeProvider.MESSAGE_SUCCESS, {
                message: af.lang.general.paused
            })
        })

        af.on('presetsChange', () => {
            ui.updatePresetList()
        })

        af.on('groupsChanged', () => {
            ui.updateGroupList()
        })

        let start = function () {
            if (af.running) {
                af.pause()
            } else {
                if (!af.presets.length) {
                    $rootScope.$broadcast(eventTypeProvider.MESSAGE_ERROR, {
                        message: af.lang.events.presetFirst
                    })

                    return false
                }

                if (!af.selectedVillage) {
                    $rootScope.$broadcast(eventTypeProvider.MESSAGE_ERROR, {
                        message: af.lang.events.noSelectedVillage
                    })

                    return false
                }

                af.start()
            }
        }

        ui.$start.on('click', start)
        hotkeys.add('shift+z', start)
    }

    let $map = document.querySelector('#map')
    let mapScope = angular.element($map).scope()

    if (mapScope.isInitialized) {
        init()
    } else {
        $rootScope.$on(eventTypeProvider.MAP_INITIALIZED, init)
    }
}
