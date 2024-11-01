# Usa una imagen de Node.js
FROM node:18

# Configura el directorio de trabajo
WORKDIR /app

# Copia el archivo de bloqueo y el package.json para instalar las dependencias
COPY package.json ./

# Instala las dependencias utilizando npm
RUN npm install

# Copia el resto del código fuente
COPY . .

# Construye la aplicación (ajusta el comando si tu proyecto usa otro comando de build)
RUN npm run build

# Expone el puerto (ajusta al puerto de tu aplicación si es diferente)
EXPOSE 3000

# Define el comando para iniciar la aplicación
CMD ["npm", "start"]