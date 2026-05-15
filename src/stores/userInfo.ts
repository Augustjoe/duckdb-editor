import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 用户信息 Pinia Store
 * 用于存储和管理登录态 Token，供 API 层动态获取
 */
export const useUserInfoStore = defineStore('userInfo', () => {
  /** 用户认证 Token */
  const token = ref<string>('')

  /** 设置 Token（登录成功后调用） */
  function setToken(t: string) {
    token.value = t
    localStorage.setItem('token', t)
  }

  /** 清除 Token（退出登录时调用） */
  function clearToken() {
    token.value = ''
    localStorage.removeItem('token')
  }

  /** 初始化时从 localStorage 恢复 Token */
  function init() {
    token.value = localStorage.getItem('token') || ''
  }

  return { token, setToken, clearToken, init }
})
