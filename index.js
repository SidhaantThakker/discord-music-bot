require('dotenv').config()
const Discord = require('discord.js')
const token = process.env.DISCORD_BOT_TOKEN
const { prefix } = require('./config.json')
const ytdl = require('ytdl-core')

const client = new Discord.Client()

const queue = new Map();

client.login(token)

client.once('ready', () => {
    console.log('[x] Client Ready!')
})

client.once('reconnecting', () => {
    console.log('[x] Client Reconnecting!')
})

client.once('disconnect', () => {
    console.log('[x] Client Disconnected!')
})

client.on('message', async message => {
    if (message.author.bot){
        return
    }
    if(!message.content.startsWith(prefix)){
        return
    }
    console.log("[x] Incoming:", message.content)
    const serverQueue = queue.get(message.guild.id)
    if(message.content.startsWith(prefix+'play')){
        execute(message, serverQueue)
        return
    } else if(message.content.startsWith(prefix+'skip')){
        skip(message, serverQueue)
        return
    } else if(message.content.startsWith(prefix+'stop')){
        stop(message, serverQueue)
        return
    } else if(message.content.startsWith(prefix+'leave')){
        queue.delete(message.guild.id)
        serverQueue.songs = [];
        serverQueue.voiceChannel.leave()
    }
    else {
        message.channel.send("Command not found!") //Add help message later
    }
})

async function execute(message, serverQueue){
    const args = message.content.split(" ")
    const voiceChannel = message.member.voice.channel
    if(!voiceChannel){
        return message.channel.send("You must be connected to a voice channel to issue a play command!")
    }
    const permissions = voiceChannel.permissionsFor(message.client.user)
    if(!permissions.has('CONNECT') || !permissions.has("SPEAK")){
        return message.channel.send("i do not have permission to join and/or speak in your voice channel!")
    }

    const songMeta = await ytdl.getInfo(args[1])
    const song = {
        title: songMeta.videoDetails.title,
        url: songMeta.videoDetails.video_url
    }

    if(!serverQueue){

        const queueContract = {
            textChannel:  message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: 5,
            playing: true
        }
        queue.set(message.guild.id, queueContract)
        queueContract.songs.push(song)

        try{
            var connection = await voiceChannel.join()
            queueContract.connection = connection
            play(message.guild, queueContract.songs[0])
        } catch(err){
            console.log(err)
            queue.delete(message.guild.id)
            return message.channel.send("Server Error [Report to Admin]- " + err)
        }
    } else {
        serverQueue.songs.push(song);
        return message.channel.send("Added : " +song.title+" to queue!")
    }   
} 

function play(guild, song){
    const serverQueue = queue.get(guild.id)
    if(!song){
        serverQueue.voiceChannel.leave()
        queue.delete(guild.id)
        return
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
    .on("finish", () => {
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0])
    })
    .on("error", error => {
        console.error(error)
    })
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);
    serverQueue.textChannel.send("Now playing: " +  song.title)
}

function skip(message, serverQueue){
    if(!message.member.voice.channel){
        return message.channel.send("Nice try - you have to be connected to voice to stop the music")
    }
    if(!serverQueue){
        return message.channel.send("Bestie what are you trying to skip?")
    }
    serverQueue.connection.dispatcher.end()
}

function stop(message, serverQueue){
    if(!message.member.voice.channel){
        return message.channel.send("Nice try - you have to be connected to voice to stop the music")
    }
    if(!serverQueue){
        return message.channel.send("Bestie what are you trying to stop?")
    }
    serverQueue.songs = [];
    serverQueue.connection.dispatcher.end()
}

