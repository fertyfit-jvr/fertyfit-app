package com.fertyfit.app

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.units.Temperature
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Length
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import java.time.Instant
import java.time.ZonedDateTime

/**
 * Health Connect Plugin for Capacitor
 * Provides access to Google Health Connect data (Android 14+)
 */
class HealthConnectPlugin : Plugin() {
    
    private val healthConnectClient: HealthConnectClient? by lazy {
        if (HealthConnectClient.isAvailable(context)) {
            HealthConnectClient.getOrCreate(context)
        } else {
            null
        }
    }
    
    /**
     * Check if Health Connect is available
     */
    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val available = HealthConnectClient.isAvailable(context)
        val result = JSObject()
        result.put("available", available)
        call.resolve(result)
    }
    
    /**
     * Request authorization to read health data
     */
    @PluginMethod
    fun requestAuthorization(call: PluginCall) {
        val healthConnect = healthConnectClient ?: run {
            call.reject("Health Connect no está disponible en este dispositivo")
            return
        }
        
        val readArray = call.getArray("read", String::class.java) ?: run {
            call.reject("Parámetros inválidos: se requiere array 'read'")
            return
        }
        
        val permissions = mutableSetOf<HealthPermission>()
        
        for (typeString in readArray) {
            when (typeString) {
                "BodyTemperature" -> {
                    permissions.add(HealthPermission.getReadPermission(BodyTemperatureRecord::class))
                }
                "SleepSession" -> {
                    permissions.add(HealthPermission.getReadPermission(SleepSessionRecord::class))
                }
                "Steps" -> {
                    permissions.add(HealthPermission.getReadPermission(StepsRecord::class))
                }
                "ActiveCaloriesBurned" -> {
                    permissions.add(HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class))
                }
                "HeartRate" -> {
                    permissions.add(HealthPermission.getReadPermission(HeartRateRecord::class))
                }
                "HeartRateVariabilityRmssd" -> {
                    permissions.add(HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class))
                }
                "OxygenSaturation" -> {
                    permissions.add(HealthPermission.getReadPermission(OxygenSaturationRecord::class))
                }
                "RespiratoryRate" -> {
                    permissions.add(HealthPermission.getReadPermission(RespiratoryRateRecord::class))
                }
            }
        }
        
        healthConnect.permissionController.requestPermissions(permissions)
            .addOnSuccessListener { granted ->
                val result = JSObject()
                result.put("granted", granted.isNotEmpty())
                call.resolve(result)
            }
            .addOnFailureListener { exception ->
                call.reject("Error solicitando permisos: ${exception.message}")
            }
    }
    
    /**
     * Check if authorization is granted
     */
    @PluginMethod
    fun checkAuthorization(call: PluginCall) {
        val healthConnect = healthConnectClient ?: run {
            call.resolve(JSObject().apply { put("granted", false) })
            return
        }
        
        val readArray = call.getArray("read", String::class.java) ?: run {
            call.reject("Parámetros inválidos: se requiere array 'read'")
            return
        }
        
        val permissions = mutableSetOf<HealthPermission>()
        
        for (typeString in readArray) {
            when (typeString) {
                "BodyTemperature" -> {
                    permissions.add(HealthPermission.getReadPermission(BodyTemperatureRecord::class))
                }
                "SleepSession" -> {
                    permissions.add(HealthPermission.getReadPermission(SleepSessionRecord::class))
                }
                "Steps" -> {
                    permissions.add(HealthPermission.getReadPermission(StepsRecord::class))
                }
            }
        }
        
        healthConnect.permissionController.getGrantedPermissions()
            .addOnSuccessListener { granted ->
                val allGranted = permissions.all { it in granted }
                val result = JSObject()
                result.put("granted", allGranted)
                call.resolve(result)
            }
            .addOnFailureListener { exception ->
                call.reject("Error verificando permisos: ${exception.message}")
            }
    }
    
    /**
     * Read health records
     */
    @PluginMethod
    fun readRecords(call: PluginCall) {
        val healthConnect = healthConnectClient ?: run {
            call.reject("Health Connect no está disponible")
            return
        }
        
        val recordType = call.getString("recordType") ?: run {
            call.reject("Parámetro requerido: recordType")
            return
        }
        
        val startTimeString = call.getString("startTime") ?: run {
            call.reject("Parámetro requerido: startTime")
            return
        }
        
        val endTimeString = call.getString("endTime") ?: run {
            call.reject("Parámetro requerido: endTime")
            return
        }
        
        val startTime = Instant.parse(startTimeString)
        val endTime = Instant.parse(endTimeString)
        val timeRange = TimeRangeFilter.between(startTime, endTime)
        
        when (recordType) {
            "BodyTemperature" -> {
                readBodyTemperature(healthConnect, timeRange, call)
            }
            "SleepSession" -> {
                readSleepSession(healthConnect, timeRange, call)
            }
            "Steps" -> {
                readSteps(healthConnect, timeRange, call)
            }
            "ActiveCaloriesBurned" -> {
                readActiveCalories(healthConnect, timeRange, call)
            }
            "HeartRate" -> {
                readHeartRate(healthConnect, timeRange, call)
            }
            "HeartRateVariabilityRmssd" -> {
                readHRV(healthConnect, timeRange, call)
            }
            "OxygenSaturation" -> {
                readOxygenSaturation(healthConnect, timeRange, call)
            }
            "RespiratoryRate" -> {
                readRespiratoryRate(healthConnect, timeRange, call)
            }
            else -> {
                call.reject("Tipo de registro no soportado: $recordType")
            }
        }
    }
    
    private fun readBodyTemperature(healthConnect: HealthConnectClient, timeRange: TimeRangeFilter, call: PluginCall) {
        healthConnect.readRecords(ReadRecordsRequest(BodyTemperatureRecord::class, timeRange))
            .addOnSuccessListener { response ->
                val records = response.records.map { record ->
                    JSObject().apply {
                        put("temperature", record.temperature.inCelsius)
                        put("time", record.time.toString())
                    }
                }
                val result = JSObject()
                result.put("records", records)
                call.resolve(result)
            }
            .addOnFailureListener { exception ->
                call.reject("Error leyendo temperatura: ${exception.message}")
            }
    }
    
    private fun readSleepSession(healthConnect: HealthConnectClient, timeRange: TimeRangeFilter, call: PluginCall) {
        healthConnect.readRecords(ReadRecordsRequest(SleepSessionRecord::class, timeRange))
            .addOnSuccessListener { response ->
                val records = response.records.map { session ->
                    val stages = session.stages?.map { stage ->
                        JSObject().apply {
                            put("stage", stage.stage)
                            put("startTime", stage.startTime.toString())
                            put("endTime", stage.endTime.toString())
                        }
                    } ?: emptyList()
                    
                    JSObject().apply {
                        put("startTime", session.startTime.toString())
                        put("endTime", session.endTime.toString())
                        put("stages", stages)
                    }
                }
                val result = JSObject()
                result.put("records", records)
                call.resolve(result)
            }
            .addOnFailureListener { exception ->
                call.reject("Error leyendo sueño: ${exception.message}")
            }
    }
    
    private fun readSteps(healthConnect: HealthConnectClient, timeRange: TimeRangeFilter, call: PluginCall) {
        healthConnect.readRecords(ReadRecordsRequest(StepsRecord::class, timeRange))
            .addOnSuccessListener { response ->
                val totalSteps = response.records.sumOf { it.count }
                val records = response.records.map { record ->
                    JSObject().apply {
                        put("count", record.count)
                        put("startTime", record.startTime.toString())
                        put("endTime", record.endTime.toString())
                    }
                }
                val result = JSObject()
                result.put("records", records)
                result.put("total", totalSteps)
                call.resolve(result)
            }
            .addOnFailureListener { exception ->
                call.reject("Error leyendo pasos: ${exception.message}")
            }
    }
    
    private fun readActiveCalories(healthConnect: HealthConnectClient, timeRange: TimeRangeFilter, call: PluginCall) {
        healthConnect.readRecords(ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, timeRange))
            .addOnSuccessListener { response ->
                val totalCalories = response.records.sumOf { it.energy.inKilocalories.toLong() }
                val records = response.records.map { record ->
                    JSObject().apply {
                        put("energy", record.energy.inKilocalories)
                        put("startTime", record.startTime.toString())
                        put("endTime", record.endTime.toString())
                    }
                }
                val result = JSObject()
                result.put("records", records)
                result.put("total", totalCalories)
                call.resolve(result)
            }
            .addOnFailureListener { exception ->
                call.reject("Error leyendo calorías: ${exception.message}")
            }
    }
    
    private fun readHeartRate(healthConnect: HealthConnectClient, timeRange: TimeRangeFilter, call: PluginCall) {
        healthConnect.readRecords(ReadRecordsRequest(HeartRateRecord::class, timeRange))
            .addOnSuccessListener { response ->
                val records = response.records.map { record ->
                    JSObject().apply {
                        put("beatsPerMinute", record.beatsPerMinute)
                        put("time", record.time.toString())
                    }
                }
                val result = JSObject()
                result.put("records", records)
                call.resolve(result)
            }
            .addOnFailureListener { exception ->
                call.reject("Error leyendo frecuencia cardíaca: ${exception.message}")
            }
    }
    
    private fun readHRV(healthConnect: HealthConnectClient, timeRange: TimeRangeFilter, call: PluginCall) {
        healthConnect.readRecords(ReadRecordsRequest(HeartRateVariabilityRmssdRecord::class, timeRange))
            .addOnSuccessListener { response ->
                val records = response.records.map { record ->
                    JSObject().apply {
                        put("heartRateVariabilityMillis", record.heartRateVariabilityMillis)
                        put("time", record.time.toString())
                    }
                }
                val result = JSObject()
                result.put("records", records)
                call.resolve(result)
            }
            .addOnFailureListener { exception ->
                call.reject("Error leyendo HRV: ${exception.message}")
            }
    }
    
    private fun readOxygenSaturation(healthConnect: HealthConnectClient, timeRange: TimeRangeFilter, call: PluginCall) {
        healthConnect.readRecords(ReadRecordsRequest(OxygenSaturationRecord::class, timeRange))
            .addOnSuccessListener { response ->
                val records = response.records.map { record ->
                    JSObject().apply {
                        put("percentage", record.percentage.value)
                        put("time", record.time.toString())
                    }
                }
                val result = JSObject()
                result.put("records", records)
                call.resolve(result)
            }
            .addOnFailureListener { exception ->
                call.reject("Error leyendo saturación de oxígeno: ${exception.message}")
            }
    }
    
    private fun readRespiratoryRate(healthConnect: HealthConnectClient, timeRange: TimeRangeFilter, call: PluginCall) {
        healthConnect.readRecords(ReadRecordsRequest(RespiratoryRateRecord::class, timeRange))
            .addOnSuccessListener { response ->
                val records = response.records.map { record ->
                    JSObject().apply {
                        put("rate", record.rate)
                        put("time", record.time.toString())
                    }
                }
                val result = JSObject()
                result.put("records", records)
                call.resolve(result)
            }
            .addOnFailureListener { exception ->
                call.reject("Error leyendo frecuencia respiratoria: ${exception.message}")
            }
    }
}

