import axios from 'axios'

const instance = axios.create({
baseURL:  `${import.meta.env.VITE_BACK_ORIGIN}${import.meta.env.VITE_API_BASE}`,
timeout: 20000
})

// Interceptor de request: añade token público y headers útiles
instance.interceptors.request.use((config) => {
const token = localStorage.getItem('public_token') || import.meta.env.VITE_PUBLIC_TOKEN
if (token) config.headers['X-Public-Token'] = token
// Content negotiation conservadora
config.headers['Accept'] = 'application/json'
return config
})

// Interceptor de respuesta básico
instance.interceptors.response.use(
r => r,
async (error) => {
// Reintento simple ante 429/503
const status = error?.response?.status
if ([429,503].includes(status)){
await new Promise(res => setTimeout(res, 750))
return instance.request(error.config)
}
return Promise.reject(error)
}
)

export default instance