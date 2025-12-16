<template>
    <n-switch v-model:value="bVal" />
    <n-auto-complete v-model:value="sVal">
        <template #empty>
            <div>ads</div>
        </template>
    </n-auto-complete>
    <n-date-picker v-model:value="dVal"></n-date-picker>
    <el-mention>
    </el-mention>
    <el-transfer>
        <template #right-footer></template>
    </el-transfer>
</template>

<script setup lang="ts">
import { NSwitch, NAutoComplete, NDatePicker } from 'naive-ui'
import { ElMention, ElTransfer } from 'element-plus'
import { ref } from 'vue';

const bVal = ref(false)
const sVal = ref('')
const dVal = ref(123)
</script>