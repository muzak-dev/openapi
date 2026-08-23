<script setup lang="ts">
import { hi } from '~/utils/highlight'

const props = defineProps<{
  context?: 'desktop' | 'sheet'
}>()

const { spec } = useOpenApiDoc()
const { page, server, mobileTry, tryPulse, authModal } = useDocsState()
const { authed, authLabel, maskedToken } = useAuth()
const {
  req, reqState, reqError, res, tryTab, history,
  ep, builtUrl, builtHeaders, bodyError,
  send, addHeader, resetRequest, resetBody, formatBody, params,
} = useTryIt()

const modKey = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl'

defineShortcuts({
  meta_enter: () => { if (ep.value) send() },
})
</script>

<template>
  <div class="flex flex-col min-h-0 h-full">
    <div class="shrink-0 px-3.5 py-3 border-b border-line" :style="tryPulse ? 'background:var(--acc-soft)' : ''">
      <div class="flex items-center gap-2">
        <span class="text-[12.5px] font-semibold tracking-[-.01em]">Try it</span>
        <span v-if="!authed" class="chip" style="color:var(--warn);border-color:color-mix(in srgb,var(--warn) 30%,transparent);background:var(--warn-soft)">no credentials</span>
        <span v-else class="chip chip-acc">authenticated</span>
        <button v-if="props.context === 'sheet'" class="icon-btn ml-auto" aria-label="Close" @click="mobileTry = false">
          <Icon name="i-lucide-x" :size="15" />
        </button>
        <button v-else class="icon-btn ml-auto" aria-label="Reset to defaults" title="Reset to defaults" @click="resetRequest">
          <Icon name="i-lucide-rotate-ccw" :size="13" />
        </button>
      </div>
      <div v-if="ep" class="mt-2 flex items-center gap-2">
        <span class="mth-lg" :data-m="ep.verb.toUpperCase()">{{ ep.verb.toUpperCase() }}</span>
        <code class="mono text-[11.5px] leading-[1.5] break-all text-mut">{{ ep.path }}</code>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto scroll px-3.5 py-3 space-y-4">
      <div>
        <label class="eyebrow block mb-1.5">Server</label>
        <div class="relative">
          <select v-model.number="server" class="inp !font-sans !text-[12px]" aria-label="Server">
            <option v-for="(sv, i) in spec?.servers || []" :key="i" :value="i">{{ sv.description || sv.url }} — {{ sv.url }}</option>
          </select>
          <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-dim"><Icon name="i-lucide-chevron-down" :size="12" /></span>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="eyebrow">Authentication</label>
          <button class="text-[11px] text-acc hover:underline" @click="authModal = true">Edit</button>
        </div>
        <button
          class="w-full flex items-center gap-2 h-[30px] px-2 rounded-md border border-line bg-sunken hover:border-line2 transition-colors"
          @click="authModal = true"
        >
          <span class="text-dim"><Icon name="i-lucide-key-round" :size="12" /></span>
          <span class="text-[11.5px] text-mut">{{ authLabel }}</span>
          <code class="mono text-[11px] text-dim ml-auto truncate max-w-[150px]">{{ maskedToken }}</code>
        </button>
      </div>

      <div v-if="params('path').length">
        <label class="eyebrow block mb-1.5">Path parameters</label>
        <div class="space-y-2">
          <div v-for="p in params('path')" :key="p.name">
            <div class="flex items-baseline gap-1.5 mb-1">
              <code class="mono text-[11.5px]">{{ p.name }}</code>
              <span class="chip chip-req ml-auto">required</span>
            </div>
            <input
              v-model="req.path[p.name]"
              class="inp"
              :placeholder="String(p.schema?.example ?? '')"
              :aria-label="p.name"
              @keydown.meta.enter="send"
              @keydown.ctrl.enter="send"
            >
          </div>
        </div>
      </div>

      <div v-if="params('query').length">
        <label class="eyebrow block mb-1.5">Query parameters</label>
        <div class="space-y-2">
          <div v-for="p in params('query')" :key="p.name">
            <div class="flex items-center gap-1.5 mb-1">
              <input v-model="req.queryOn[p.name]" type="checkbox" class="accent-[color:var(--acc)] w-[13px] h-[13px]" :aria-label="`Include ${p.name}`">
              <code class="mono text-[11.5px]" :class="req.queryOn[p.name] ? '' : 'text-dim'">{{ p.name }}</code>
            </div>
            <select
              v-if="p.schema?.enum"
              v-model="req.query[p.name]"
              class="inp !font-sans !text-[11.5px]"
              :disabled="!req.queryOn[p.name]"
              :aria-label="p.name"
            >
              <option v-for="o in p.schema.enum" :key="String(o)" :value="o">{{ o }}</option>
            </select>
            <input
              v-else
              v-model="req.query[p.name]"
              class="inp"
              :disabled="!req.queryOn[p.name]"
              :placeholder="String(p.schema?.default ?? p.schema?.example ?? '')"
              :aria-label="p.name"
              @keydown.meta.enter="send"
              @keydown.ctrl.enter="send"
            >
          </div>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="eyebrow">Headers</label>
          <button class="text-[11px] text-acc hover:underline flex items-center gap-1" @click="addHeader">
            <Icon name="i-lucide-plus" :size="10" /> Add
          </button>
        </div>
        <div class="space-y-1.5">
          <div v-for="(h, i) in req.headers" :key="i" class="flex items-center gap-1.5">
            <input v-model="h.k" class="inp !w-[42%]" placeholder="Header" aria-label="Header name">
            <input v-model="h.v" class="inp flex-1 min-w-0" placeholder="Value" aria-label="Header value">
            <button class="icon-btn !w-6 !h-6" aria-label="Remove header" @click="req.headers.splice(i, 1)">
              <Icon name="i-lucide-x" :size="11" />
            </button>
          </div>
          <p v-if="!req.headers.length" class="text-[11.5px] text-dim">Only the auth header will be sent.</p>
        </div>
      </div>

      <div v-if="ep?.requestBody">
        <div class="flex items-center justify-between mb-1.5">
          <label class="eyebrow">Body — {{ ep.requestBody.contentType }}</label>
          <div class="flex items-center gap-2">
            <button class="text-[11px] text-acc hover:underline" @click="formatBody">Format</button>
            <button class="text-[11px] text-acc hover:underline" @click="resetBody">Reset</button>
          </div>
        </div>
        <JsonEditor v-model="req.body" aria-label="Request body" @submit="send" />
        <p v-if="bodyError" class="text-[11px] mt-1" style="color:var(--err)">{{ bodyError }}</p>
      </div>

      <div class="pt-0.5">
        <button class="btn btn-primary w-full !h-9" :disabled="reqState === 'loading'" @click="send">
          <Icon v-if="reqState === 'loading'" name="i-lucide-loader-circle" :size="14" class="spin" />
          <Icon v-else name="i-lucide-send" :size="13" />
          <span>{{ reqState === 'loading' ? 'Sending…' : 'Send request' }}</span>
          <span class="kbd ml-1 hidden sm:inline">{{ modKey }} ↵</span>
        </button>
      </div>

      <div class="pt-1">
        <div class="flex items-center gap-0.5 p-0.5 rounded-md bg-elev border border-line">
          <button class="stab flex-1" :class="{ on: tryTab === 'request' }" @click="tryTab = 'request'">Request</button>
          <button class="stab flex-1" :class="{ on: tryTab === 'response' }" @click="tryTab = 'response'">Response</button>
          <button class="stab flex-1" :class="{ on: tryTab === 'headers' }" @click="tryTab = 'headers'">Headers</button>
        </div>

        <div v-if="tryTab === 'request'" class="mt-2.5 space-y-2.5">
          <div class="rounded-md border border-line bg-codebg p-2.5">
            <p class="eyebrow mb-1">URL</p>
            <code class="mono text-[11px] break-all leading-relaxed"><span class="c-kw">{{ ep?.verb.toUpperCase() }}</span> {{ builtUrl }}</code>
          </div>
          <div class="rounded-md border border-line bg-codebg p-2.5">
            <p class="eyebrow mb-1.5">Headers</p>
            <div v-for="(v, k) in builtHeaders" :key="k" class="flex gap-2 text-[11px] mono leading-relaxed">
              <span class="c-key shrink-0">{{ k }}:</span><span class="text-mut break-all">{{ v }}</span>
            </div>
          </div>
          <div v-if="ep?.requestBody" class="rounded-md border border-line bg-codebg p-2.5">
            <p class="eyebrow mb-1.5">Body</p>
            <pre class="mono text-[11px] leading-[1.7] overflow-x-auto scroll-x" v-html="hi(req.body, 'json')" />
          </div>
        </div>

        <div v-else-if="tryTab === 'response'" class="mt-2.5">
          <div v-if="reqState === 'loading'" class="rounded-md border border-line bg-elev p-4 text-center">
            <span class="inline-flex items-center gap-2 text-[12px] text-mut pulse">
              <Icon name="i-lucide-loader-circle" :size="13" class="spin" /> Loading response…
            </span>
          </div>
          <div v-else-if="reqState === 'error'" class="rounded-md border p-3.5 text-center" style="border-color:color-mix(in srgb,var(--err) 30%,transparent);background:var(--err-soft)">
            <p class="text-[12.5px] font-medium" style="color:var(--err)">Request failed</p>
            <p class="text-[11.5px] text-mut mt-1">{{ reqError }}</p>
            <button class="btn mt-2.5 mx-auto" @click="send"><Icon name="i-lucide-rotate-ccw" :size="12" /> Retry</button>
          </div>
          <div v-else-if="!res" class="rounded-md border border-dashed border-line2 p-5 text-center">
            <p class="text-[12.5px] text-mut">No response yet</p>
            <p class="text-[11.5px] text-dim mt-1">Send a request to see the response.</p>
          </div>
          <div v-else class="fade-in">
            <div class="flex items-center gap-2.5 mb-2">
              <span class="st text-[12px]" :data-s="String(res.status)[0]">{{ res.status }} {{ res.statusText }}</span>
              <span class="mono text-[11px] text-dim tnum">{{ res.ms }}ms</span>
              <span class="mono text-[11px] text-dim tnum">{{ res.size }}</span>
              <CopyButton class="!w-6 !h-6 ml-auto" :text="res.bodyText" copy-key="resbody" :icon-size="12" />
            </div>
            <div class="rounded-md border border-line bg-codebg p-2.5 max-h-[320px] overflow-auto scroll">
              <pre class="mono text-[11px] leading-[1.7]" v-html="hi(res.bodyText, 'json')" />
            </div>
          </div>
        </div>

        <div v-else class="mt-2.5">
          <div v-if="!res" class="rounded-md border border-dashed border-line2 p-5 text-center">
            <p class="text-[12.5px] text-mut">No headers yet</p>
            <p class="text-[11.5px] text-dim mt-1">Response headers appear after a request.</p>
          </div>
          <div v-else class="rounded-md border border-line overflow-hidden">
            <div v-for="(v, k) in res.headers" :key="k" class="flex items-start gap-2 px-2.5 py-1.5 border-t border-line first:border-t-0 group hover:bg-elev transition-colors">
              <code class="mono text-[11px] c-key w-[132px] shrink-0 break-all">{{ k }}</code>
              <code class="mono text-[11px] text-mut flex-1 break-all">{{ v }}</code>
              <CopyButton class="!w-5 !h-5 opacity-0 group-hover:opacity-100 transition-opacity" :text="v" :copy-key="`h-${k}`" :icon-size="10" />
            </div>
          </div>
        </div>
      </div>

      <div v-if="history.length" class="pt-1 pb-2">
        <div class="flex items-center justify-between mb-1.5">
          <label class="eyebrow">Recent requests</label>
          <button class="text-[11px] text-dim hover:text-fg transition-colors" @click="history.length = 0">Clear</button>
        </div>
        <div class="rounded-md border border-line overflow-hidden">
          <button
            v-for="(h, i) in history" :key="i"
            class="w-full flex items-center gap-2 px-2.5 py-[7px] border-t border-line first:border-t-0 hover:bg-elev transition-colors text-left"
            @click="page = { type: 'endpoint', id: h.opId }"
          >
            <span class="mth w-[38px] text-right shrink-0" :data-m="h.method">{{ h.method }}</span>
            <span class="mono text-[11px] text-mut truncate flex-1">{{ h.path }}</span>
            <span class="st text-[10.5px] shrink-0" :data-s="String(h.status)[0]">{{ h.status }}</span>
            <span class="mono text-[10.5px] text-dim tnum w-[42px] text-right shrink-0">{{ h.ms }}ms</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
