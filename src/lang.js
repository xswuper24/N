AutoFarm.prototype.i18n = function () {
    let locales = {
        pt_br: @@langs-pt_br,
        en_us: @@langs-en_us
    }

    let gameLang = require('conf/locale').LANGUAGE

    let aliases = {
        'pt_pt': 'pt_br',
        'en_dk': 'en_us'
    }

    if (gameLang in aliases) {
        gameLang = aliases[gameLang]
    }

    if (this.settings.language) {
        this.lang = locales[this.settings.language]
    } else {
        this.lang = gameLang in locales
            ? locales[gameLang]
            : locales['en_us']
    }
}
