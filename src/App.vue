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
                                <b-col lg="5"><strong>Address</strong></b-col>
                                <b-col lg="2"><strong>VET</strong></b-col>
                                <b-col lg="2"><strong>Staked</strong></b-col>
                                <b-col lg="2"><strong>VTHO</strong></b-col>
                            </b-row>
                        </b-list-group-item>
                        <b-list-group-item v-for="(item, index) in list" :key="index">
                            <b-row class="justify-content-center my-1">
                                <b-col lg="1"><strong>{{ index + 1 }}</strong></b-col>
                                <b-col lg="5">
                                    <a :href="explorer.account(item.address)" class="text-monospace"
                                        target="_blank">{{ item.address }}</a>
                                </b-col>
                                <b-col lg="2" sm="3">
                                    <span v-b-tooltip.hover
                                        :title="bigNumberToFormated(item.VET)"
                                        target="_blank">{{ bigNumberToDisplay(item.VET) }}
                                    </span>
                                </b-col>
                                <b-col lg="2" sm="3">
                                    <span v-b-tooltip.hover
                                        :title="bigNumberToFormated(item.staked)">{{ bigNumberToDisplay(item.staked) }}
                                    </span>
                                </b-col>
                                <b-col lg="2" sm="3">
                                    <span v-b-tooltip.hover
                                        :title="bigNumberToFormated(item.VTHO)"
                                        target="_blank">{{ bigNumberToDisplay(item.VTHO) }}
                                    </span>
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
import { RLP, blake2b256 } from 'thor-devkit'

const E18 = new BigNumber(10).pow(18)
const thor = inject<Connex.Thor>('$thor')!
const nodeUrl = inject<string>('$nodeUrl')!
const file = ref<File | null>(null)
const valid = ref<Boolean | null>(null)
const list = ref<{ address: string; VET: string; VTHO: string; staked: string }[]>([])
const toaster = ref<Boolean>(false)
const message = ref<string>("")
const loading = ref<Boolean>(false)
const downloadable = ref<Boolean>(false)
let queryTime = 0

const STAKER_ADDRESS = '0x00000000000000000000000000005374616B6572'

const validationQueuedABI = {
    "anonymous": false,
    "inputs": [
        {"indexed": true, "name": "validator", "type": "address"},
        {"indexed": true, "name": "endorser", "type": "address"},
        {"indexed": false, "name": "period", "type": "uint32"},
        {"indexed": false, "name": "stake", "type": "uint256"}
    ],
    "name": "ValidationQueued",
    "type": "event"
}

class DummyKind extends RLP.ScalarKind {
    public data(_data: any, _ctx: string) {
        return { encode() { return Buffer.alloc(0) } }
    }
    public buffer(_buf: Buffer, _ctx: string) {
        return { decode() { return null } }
    }
}

async function fetchRawStorage(address: string, key: string): Promise<string> {
    const url = `${nodeUrl}/accounts/${address}/storage/raw/${key}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Failed to fetch raw storage: ${response.statusText}`)
    const data = await response.json() as { value: string }
    return data.value
}

async function getValidationDetail(validatorAddress: string): Promise<{
    lockedVET: number | string
    queuedVET: number | string
    cooldownVET: number | string
    withdrawableVET: number | string
} | null> {
    try {
        const addressBytes = Buffer.from(validatorAddress.slice(2), 'hex')
        const validationsBytes = Buffer.from('validations', 'utf8')
        const suffix = Buffer.alloc(32)
        validationsBytes.copy(suffix, 32 - validationsBytes.length)
        const key = '0x' + (blake2b256 as any)(addressBytes, suffix).toString('hex')
        const rawValue = await fetchRawStorage(STAKER_ADDRESS, key)
        if (!rawValue || rawValue === '0x' || rawValue === '0x0') return null

        const data = Buffer.from(rawValue.slice(2), 'hex')

        const profile = new RLP({
            name: 'validation',
            kind: [
                { name: 'endorser', kind: new DummyKind() },
                { name: 'beneficiary', kind: new DummyKind() },
                { name: 'period', kind: new DummyKind() },
                { name: 'completedPeriods', kind: new DummyKind() },
                { name: 'status', kind: new DummyKind() },
                { name: 'startBlock', kind: new DummyKind() },
                { name: 'exitBlock', kind: new DummyKind() },
                { name: 'offlineBlock', kind: new DummyKind() },
                { name: 'lockedVET', kind: new RLP.NumericKind(8) },
                { name: 'pendingUnlockVET', kind: new DummyKind() },
                { name: 'queuedVET', kind: new RLP.NumericKind(8) },
                { name: 'cooldownVET', kind: new RLP.NumericKind(8) },
                { name: 'withdrawableVET', kind: new RLP.NumericKind(8) },
                { name: 'weight', kind: new DummyKind() },
                { name: 'linkedListEntry', kind: [{ name: 'prev', kind: new DummyKind() }, { name: 'next', kind: new DummyKind() }] }
            ]
        })
        const decoded = profile.decode(data) as any
        return {
            lockedVET: decoded.lockedVET || 0,
            queuedVET: decoded.queuedVET || 0,
            cooldownVET: decoded.cooldownVET || 0,
            withdrawableVET: decoded.withdrawableVET || 0
        }
    } catch {
        return null
    }
}

async function getEndorserTotalVET(endorserAddress: string): Promise<string> {
    try {
        // Step 1: Find all validators for this endorser via ValidationQueued events
        const eventFilter = thor.account(STAKER_ADDRESS)
            .event(validationQueuedABI)
            .filter([{ endorser: endorserAddress }])

        const PAGE_SIZE = 256
        const allValidatorAddresses: string[] = []
        let offset = 0
        while (true) {
            const logs = await eventFilter.order('asc').apply(offset, PAGE_SIZE)
            if (logs.length === 0) break
            for (const log of logs) {
                allValidatorAddresses.push(log.decoded.validator)
            }
            if (logs.length < PAGE_SIZE) break
            offset += PAGE_SIZE
        }
        const validatorAddresses = [...new Set(allValidatorAddresses)]
        if (validatorAddresses.length === 0) return '0'

        // Step 2: Get validation detail for each validator and aggregate
        let total = BigInt(0)
        const results = await Promise.allSettled(
            validatorAddresses.map(addr => getValidationDetail(addr))
        )
        for (const result of results) {
            if (result.status !== 'fulfilled' || !result.value) continue
            const d = result.value
            // Storage values are in VET units, multiply by 1e18 to get wei
            total += BigInt(d.lockedVET) * BigInt(1e18)
            total += BigInt(d.queuedVET) * BigInt(1e18)
            total += BigInt(d.cooldownVET) * BigInt(1e18)
            total += BigInt(d.withdrawableVET) * BigInt(1e18)
        }
        return total.toString()
    } catch {
        return '-'
    }
}

const explorer = {
    account: (address: string) => {
        return `https://explore.vechain.org/address/${address}`
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
                        VTHO: '-',
                        staked: '-'
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
                    try {
                        list.value[l].staked = await getEndorserTotalVET(list.value[l].address.toLocaleLowerCase())
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

    const content = [["No.", "Address", "VET", "Staked", "VTHO"].join(",")]
    for (let i = 0; i < list.value.length; i++) {
        const item = list.value[i]
        content.push(`${i + 1},${item.address},${bigNumberToCSV(item.VET)},${bigNumberToCSV(item.staked)},${bigNumberToCSV(item.VTHO)}`)
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