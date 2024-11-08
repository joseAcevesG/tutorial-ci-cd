# Usa una imagen de Node.js 20
FROM node:20

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

# Expone el puerto 8080 para uso interno y externo
EXPOSE 8080

# Define el comando para iniciar la aplicación y especifica el puerto 8080
ENV PORT=8080
CMD ["npm", "start"]