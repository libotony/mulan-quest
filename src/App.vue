<template>
    <div id="app">
        <b-toast v-model="toaster" variant="warning" toaster="b-toaster-top-center" auto-hide-delay="1500" solid>
            <template #toast-title>
                <div class="d-flex flex-grow-1 align-items-baseline">
                    <strong class="mr-auto">Notice!</strong>
                </div>
            </template>
            {{ message }}
        </b-toast>
        <b-container class="w-75 mx-auto">
            <b-container class="mt-4 ">
                <b-overlay :show="loading" rounded="sm">
                    <div class="jumbotron">
                        <h1 class="display-5 text-primary">Mulan Quest</h1>
                        <p class="lead">Batch account checker for vechain.</p>
                        <hr class="my-4">
                            <b-input-group>
                                <b-form-file accpet="text/csv" v-model="file" :state="valid"
                                    placeholder="Choose a csv file or drop it here..."
                                    drop-placeholder="Drop csv file here...">
                                </b-form-file>
                                <b-input-group-append>
                                    <b-button :disabled="!downloadable" variant="outline-info" @click="download">Download</b-button>
                                </b-input-group-append>
                            </b-input-group>
                    </div>
                </b-overlay>
            </b-container>
            <b-container v-show="list.length > 0">
                <b-card no-body>
                    <b-list-group flush>
                        <b-list-group-item class="title-with-bg">
                            <b-row>
                                <b-col lg="1"><strong>NO.</strong></b-col>
                                <b-col lg="7"><strong>Address</strong></b-col>
                                <b-col lg="2"><strong>VET</strong></b-col>
                                <b-col lg="2"><strong>VTHO</strong></b-col>
                            </b-row>
                        </b-list-group-item>
                        <b-list-group-item v-for="(item, index) in list" :key="index">
                            <b-row class="justify-content-center my-1">
                                <b-col lg="1"><strong>{{ index + 1 }}</strong></b-col>
                                <b-col lg="7">
                                    <a :href="explorer.account(item.address)" class="text-monospace"
                                        target="_blank">{{ item.address }}</a>
                                </b-col>
                                <b-col lg="2" sm="3">
                                    <a :href="explorer.VET(item.address)" v-b-tooltip.hover
                                        :title="bigNumberToFormated(item.VET)" 
                                        target="_blank">{{ bigNumberToDisplay(item.VET) }}</a>
                                </b-col>
                                <b-col lg="2" sm="3">
                                    <a :href="explorer.VTHO(item.address)" v-b-tooltip.hover
                                        :title="bigNumberToFormated(item.VTHO)"
                                        target="_blank">{{ bigNumberToDisplay(item.VTHO) }}
                                    </a>
                                </b-col>
                            </b-row>
                        </b-list-group-item>
                    </b-list-group>
                </b-card>
            </b-container>
        </b-container>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, inject } from 'vue'
import BigNumber from 'bignumber.js'

const E18 = new BigNumber(10).pow(18)
const thor = inject<Connex.Thor>('$thor')!
const file = ref<File | null>(null)
const valid = ref<Boolean | null>(null)
const list = ref<{ address: string; VET: string; VTHO: string }[]>([])
const toaster = ref<Boolean>(false)
const message = ref<string>("")
const loading = ref<Boolean>(false)
const downloadable = ref<Boolean>(false)
let queryTime = 0

const explorer = {
    account: (address: string) => {
        return `https://explore.vechain.org/accounts/${address}`
    },
    VET: (address: string) => {
        return `https://explore.vechain.org/accounts/${address}/transfer?token=VET`
    },
    VTHO: (address: string) => {
        return `https://explore.vechain.org/${address}/transfer?token=VTHO`
    }
}

const showToast = (str: string) => {
    message.value = str
    toaster.value = true
}

const bigNumberToDisplay = (input: string) => {
    if (input === "-") {
        return input
    }
    const bn = new BigNumber(input)
    return bn.dividedBy(E18).toFormat(0)
}

const bigNumberToFormated = (input: string) => {
    if (input === "-") {
        return input
    }
    const bn = new BigNumber(input)
    return bn.dividedBy(E18).toFormat()
}

const bigNumberToCSV = (input: string) => {
    if (input === "-") {
        return input
    }
    const bn = new BigNumber(input)
    return bn.dividedBy(E18).toFixed(0)
}

watch(file, async () => {
    if (file.value) {
        if (file.value.type !== 'text/csv') {
            valid.value = false
            return
        }

        const raw = await file.value.arrayBuffer()
        const dec = new TextDecoder('utf-8')
        const data = dec.decode(raw)
        const lines = data.split('\n')

        if (lines.length === 0) {
            showToast("No valid address found in the csv file.")
            valid.value = false
            return
        }

        loading.value = false
        downloadable.value = false
        list.value = []
        for (const line of lines) {
            if (line.length) {
                // sanitize input
                const cell0 = (line.split(',')[0]||'').replace(/^\s+|\s+$/g, '').toLowerCase()
                if (/^0x[0-9a-fA-f]{40}$/i.test(cell0)) {
                    list.value.push({
                        address: cell0,
                        VET: '-',
                        VTHO: '-'
                    })
                }
            }
        }

        if (list.value.length === 0) {
            showToast("No valid address found in the csv file.")
            valid.value = false
            return
        }
        valid.value = true
        loading.value = true

        for (let i = 0; i <= (list.value.length / 10) + 1; i++) {
            const pms: Promise<void>[] = []
            for (let j = 0; j < 10; j++) {
                const k = i * 10 + j
                if (k > list.value.length - 1) {
                    break
                }
                pms.push((async () => {
                    const l =  k
                    try {
                        const account = await thor.account(list.value[l].address.toLocaleLowerCase()).get()
                        list.value[l].VET = account.balance
                        list.value[l].VTHO = account.energy
                    } catch{}
                })())
            }
            await Promise.all(pms)
        }
        loading.value = false
        downloadable.value = true
        queryTime = Date.now()
    } else {
        valid.value = null
    }
})

const download = () => {
    if (!downloadable.value) {
        return
    }

    const content = [["No.", "Address", "VET", "VTHO"].join(",")]
    for (let i = 0; i < list.value.length; i++) {
        const item = list.value[i]
        content.push(`${i + 1},${item.address},${bigNumberToCSV(item.VET)},${bigNumberToCSV(item.VTHO)}`)
    }
    const fileName=`MulanQuest-${new Date(queryTime).toISOString()}.csv`
    const el = document.createElement('a')
    const blob = new Blob([content.join("\n")], { type: 'text/csv;charset=utf-8;' })
    el.href = URL.createObjectURL(blob)
    el.setAttribute('download', fileName)
    el.click()
}

</script>

<style>
.title-with-bg {
    background-color: rgba(0, 0, 0, 0.03) !important;
}
</style>